import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from 'decimal.js';
import { ClaveAccesoService } from './clave-acceso.service';
import { XmlBuilderService } from './xml-builder.service';
import { XmlSignerService } from './xml-signer.service';
import { SriSoapClient } from './sri-soap.client';
import { SriRepositoryService } from './sri-repository.service';
import { XmlStorageService } from './xml-storage.service';
import { SriBaseService } from './sri-base.service';
import { CreateNotaCreditoDto, NotaCreditoResponseDto } from '../dto';
import {
  InfoTributaria,
  NotaCredito,
  InfoNotaCredito,
  DetalleNotaCredito,
  TotalImpuesto,
  SriOperationResult,
} from '../interfaces';
import { TipoComprobante, Ambiente, TipoEmision } from '../constants';

@Injectable()
export class NotaCreditoService {
  private readonly logger = new Logger(NotaCreditoService.name);

  constructor(
    private readonly claveAccesoService: ClaveAccesoService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly sriSoapClient: SriSoapClient,
    private readonly repository: SriRepositoryService,
    private readonly xmlStorage: XmlStorageService,
    private readonly base: SriBaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Emite una Nota de Crédito electrónica
   */
  async emitirNotaCredito(
    dto: CreateNotaCreditoDto,
  ): Promise<NotaCreditoResponseDto> {
    this.logger.log('Iniciando emisión de nota de crédito');

    try {
      // Validar identificación del comprador
      this.base.validarIdentificacion(
        dto.comprador.tipoIdentificacion,
        dto.comprador.identificacion,
        'comprador',
      );

      // Validar tipo de identificación contra catálogo
      await this.base.validarTipoIdentificacionCatalogo(
        dto.comprador.tipoIdentificacion,
      );

      // Validar códigos de impuesto contra catálogo
      await this.base.validarImpuestosDetalles(dto.detalles);

      // Validar documento sustento contra catálogo
      await this.base.validarDocumentoSustentoCatalogo(dto.codDocModificado);

      const ambiente = dto.ambiente || this.base.getDefaultAmbiente();
      const tipoEmision = dto.tipoEmision || TipoEmision.NORMAL;

      // Get emisor info from database
      const emisor = await this.repository.findEmisorByRuc(dto.emisor.ruc);
      const puntoEmisionInfo = emisor
        ? await this.repository.findPuntoEmision(
            emisor.id,
            dto.emisor.establecimiento,
            dto.emisor.puntoEmision,
          )
        : null;

      // Handle secuencial - auto-generate if not provided
      let secuencial: string;
      if (dto.secuencial) {
        secuencial = dto.secuencial.padStart(9, '0');
        this.logger.log(`Usando secuencial NC proporcionado: ${secuencial}`);
      } else {
        if (!puntoEmisionInfo) {
          throw new BadRequestException(
            'Para auto-generar secuencial NC, el emisor debe estar registrado en la base de datos',
          );
        }
        const nextSecuencial = await this.repository.getNextSecuencial(
          puntoEmisionInfo.punto_emision_id,
          TipoComprobante.NOTA_CREDITO,
        );
        secuencial = nextSecuencial;
        this.logger.log(`Secuencial NC auto-generado: ${secuencial}`);
      }

      const [day, month, year] = dto.fechaEmision.split('/');
      const fechaEmision = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
      );

      const claveAcceso = this.claveAccesoService.generate({
        fechaEmision,
        tipoComprobante: TipoComprobante.NOTA_CREDITO,
        ruc: dto.emisor.ruc,
        ambiente,
        establecimiento: dto.emisor.establecimiento,
        puntoEmision: dto.emisor.puntoEmision,
        secuencial,
        tipoEmision,
      });

      this.logger.log(`Clave de acceso NC generada: ${claveAcceso}`);

      const notaCredito = this.buildNotaCreditoFromDto(
        dto,
        claveAcceso,
        secuencial,
        ambiente,
        tipoEmision,
      );
      const xml = this.xmlBuilderService.buildNotaCredito(notaCredito);
      this.logger.log('XML de nota de crédito generado');

      // Verify emisor has certificate in database
      if (!emisor || !emisor.certificado_p12) {
        throw new BadRequestException(
          `El emisor ${dto.emisor.ruc} no tiene certificado P12 configurado. ` +
            `Use el endpoint /certificates/upload-cert para subir el certificado.`,
        );
      }

      this.logger.log(
        `Firmando NC con certificado del emisor: ${emisor.certificado_nombre}`,
      );
      const xmlFirmado = await this.xmlSignerService.signXmlForEmisor(
        xml,
        dto.emisor.ruc,
      );
      this.logger.log('XML de nota de crédito firmado con XAdES-BES');

      const resultado = await this.sriSoapClient.enviarYAutorizar(
        xmlFirmado,
        claveAcceso,
      );

      // Persistir en base de datos
      if (emisor && puntoEmisionInfo) {
        await this.persistirNotaCredito(
          dto,
          notaCredito,
          emisor.id,
          puntoEmisionInfo.punto_emision_id,
          claveAcceso,
          secuencial,
          ambiente,
          tipoEmision,
          xml,
          xmlFirmado,
          resultado,
        );
      } else {
        this.logger.warn(
          'Emisor no encontrado en BD, nota de crédito no persistida',
        );
      }

      return this.mapResultToNotaCreditoResponse(resultado);
    } catch (error) {
      this.logger.error(
        `Error al emitir nota de crédito: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Persists Nota de Crédito and all related data to database
   */
  private async persistirNotaCredito(
    dto: CreateNotaCreditoDto,
    notaCredito: NotaCredito,
    emisorId: string,
    puntoEmisionId: string,
    claveAcceso: string,
    secuencial: string,
    ambiente: string,
    tipoEmision: string,
    xmlSinFirma: string,
    xmlFirmado: string,
    resultado: SriOperationResult,
  ): Promise<void> {
    try {
      await this.repository.executeInTransaction(async (client) => {
        // 1. Create main comprobante record
        const comprobante = await this.repository.createComprobante(
          {
            emisor_id: emisorId,
            punto_emision_id: puntoEmisionId,
            tipo_comprobante: TipoComprobante.NOTA_CREDITO,
            ambiente,
            tipo_emision: tipoEmision,
            secuencial,
            clave_acceso: claveAcceso,
            fecha_emision: dto.fechaEmision.split('/').reverse().join('-'),
            estado: resultado.success ? 'AUTORIZADO' : resultado.estado,
            estado_sri: resultado.estado,
            fecha_autorizacion: resultado.fechaAutorizacion,
            numero_autorizacion: resultado.numeroAutorizacion || claveAcceso,
            total_sin_impuestos: notaCredito.infoNotaCredito.totalSinImpuestos,
            total_descuento: 0,
            importe_total: notaCredito.infoNotaCredito.valorModificacion,
            moneda: notaCredito.infoNotaCredito.moneda,
            receptor_tipo_identificacion: dto.comprador.tipoIdentificacion,
            receptor_identificacion: dto.comprador.identificacion,
            receptor_razon_social: dto.comprador.razonSocial,
            receptor_direccion: dto.comprador.direccion,
            receptor_email: dto.comprador.email,
            receptor_telefono: dto.comprador.telefono,
            doc_modificado_tipo: dto.codDocModificado,
            doc_modificado_numero: dto.numDocModificado,
            doc_modificado_fecha: dto.fechaEmisionDocSustento
              ?.split('/')
              .reverse()
              .join('-'),
            motivo: dto.motivo,
          },
          client,
        );

        this.logger.log(`Nota de Crédito creada con ID: ${comprobante.id}`);

        // 2. Create detalles and their impuestos
        for (let i = 0; i < notaCredito.detalles.length; i++) {
          const det = notaCredito.detalles[i];
          const detalleRecords = await this.repository.createDetalles(
            [
              {
                comprobante_id: comprobante.id!,
                codigo_principal: det.codigoInterno,
                codigo_auxiliar: det.codigoAdicional,
                descripcion: det.descripcion,
                cantidad: det.cantidad,
                precio_unitario: det.precioUnitario,
                descuento: det.descuento,
                precio_total_sin_impuesto: det.precioTotalSinImpuesto,
                orden: i,
              },
            ],
            client,
          );

          const detalleId = detalleRecords[0].id!;

          // Create impuestos for this detalle
          if (det.impuestos && det.impuestos.length > 0) {
            await this.repository.createImpuestos(
              det.impuestos.map((imp) => ({
                comprobante_detalle_id: detalleId,
                codigo: imp.codigo,
                codigo_porcentaje: imp.codigoPorcentaje,
                tarifa: imp.tarifa,
                base_imponible: imp.baseImponible,
                valor: imp.valor,
              })),
              client,
            );
          }
        }

        // 3. Create totales (totalConImpuestos)
        if (notaCredito.infoNotaCredito.totalConImpuestos) {
          await this.repository.createTotales(
            notaCredito.infoNotaCredito.totalConImpuestos.map((tot) => ({
              comprobante_id: comprobante.id!,
              codigo: tot.codigo,
              codigo_porcentaje: tot.codigoPorcentaje,
              base_imponible: tot.baseImponible,
              valor: tot.valor,
            })),
            client,
          );
        }

        // 4. Save signed XML always (needed for retry), authorized only if authorized
        const fechaEmision = new Date(
          parseInt(dto.fechaEmision.split('/')[2]),
          parseInt(dto.fechaEmision.split('/')[1]) - 1,
          parseInt(dto.fechaEmision.split('/')[0]),
        );
        const xmlPaths = this.xmlStorage.saveAllXmls(
          dto.emisor.ruc,
          claveAcceso,
          fechaEmision,
          undefined,
          xmlFirmado, // firmado - always save for retry
          resultado.xmlAutorizado,
        );
        await this.repository.saveXml(
          {
            comprobante_id: comprobante.id!,
            xml_firmado_path: xmlPaths.firmadoPath,
            xml_autorizado_path: xmlPaths.autorizadoPath,
          },
          client,
        );

        // 5. Create info adicional
        if (dto.infoAdicional && dto.infoAdicional.length > 0) {
          await this.repository.createInfoAdicional(
            dto.infoAdicional.map((info) => ({
              comprobante_id: comprobante.id!,
              nombre: info.nombre,
              valor: info.valor,
            })),
            client,
          );
        }

        this.logger.log(
          `Nota de Crédito ${claveAcceso} persistida correctamente`,
        );
      });
    } catch (error) {
      this.logger.error(
        `CRÍTICO: NC ${claveAcceso} autorizada por SRI pero NO persistida: ${(error as Error).message}`,
      );
      this.eventEmitter.emit('comprobante.persistencia_fallida', {
        claveAcceso,
        emisorRuc: dto.emisor.ruc,
        tipoComprobante: TipoComprobante.NOTA_CREDITO,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Construye objeto NotaCredito desde el DTO
   */
  private buildNotaCreditoFromDto(
    dto: CreateNotaCreditoDto,
    claveAcceso: string,
    secuencial: string,
    ambiente: Ambiente,
    tipoEmision: TipoEmision,
  ): NotaCredito {
    const detalles = this.buildDetallesNotaCredito(dto.detalles);
    const { totalSinImpuestos, totalConImpuestos, valorModificacion } =
      this.calculateTotalesNotaCredito(detalles);

    const infoTributaria: InfoTributaria = {
      ambiente,
      tipoEmision,
      razonSocial: dto.emisor.razonSocial,
      nombreComercial: dto.emisor.nombreComercial,
      ruc: dto.emisor.ruc,
      claveAcceso,
      codDoc: TipoComprobante.NOTA_CREDITO,
      estab: dto.emisor.establecimiento.padStart(3, '0'),
      ptoEmi: dto.emisor.puntoEmision.padStart(3, '0'),
      secuencial: secuencial.padStart(9, '0'),
      dirMatriz: dto.emisor.dirMatriz,
      agenteRetencion: dto.emisor.agenteRetencion,
      contribuyenteRimpe: dto.emisor.contribuyenteRimpe,
    };

    const infoNotaCredito: InfoNotaCredito = {
      fechaEmision: dto.fechaEmision,
      dirEstablecimiento: dto.emisor.dirEstablecimiento,
      tipoIdentificacionComprador: dto.comprador.tipoIdentificacion,
      razonSocialComprador: dto.comprador.razonSocial,
      identificacionComprador: dto.comprador.identificacion,
      contribuyenteEspecial: dto.emisor.contribuyenteEspecial,
      obligadoContabilidad: dto.emisor.obligadoContabilidad,
      codDocModificado: dto.codDocModificado,
      numDocModificado: dto.numDocModificado,
      fechaEmisionDocSustento: dto.fechaEmisionDocSustento,
      totalSinImpuestos,
      valorModificacion,
      moneda: 'DOLAR',
      totalConImpuestos,
      motivo: dto.motivo,
    };

    const notaCredito: NotaCredito = {
      infoTributaria,
      infoNotaCredito,
      detalles,
    };

    // Información adicional
    const infoAdicional: any[] = [];

    if (dto.comprador.email) {
      infoAdicional.push({ nombre: 'email', valor: dto.comprador.email });
    }
    if (dto.comprador.direccion) {
      infoAdicional.push({
        nombre: 'direccion',
        valor: dto.comprador.direccion,
      });
    }

    if (dto.infoAdicional) {
      infoAdicional.push(...dto.infoAdicional);
    }

    if (infoAdicional.length > 0) {
      notaCredito.infoAdicional = infoAdicional;
    }

    return notaCredito;
  }

  private buildDetallesNotaCredito(
    dtoDetalles: CreateNotaCreditoDto['detalles'],
  ): DetalleNotaCredito[] {
    return dtoDetalles.map((d) => {
      const precioTotalSinImpuesto =
        d.cantidad * d.precioUnitario - d.descuento;

      return {
        codigoInterno: d.codigoPrincipal,
        codigoAdicional: d.codigoAuxiliar,
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        descuento: d.descuento,
        precioTotalSinImpuesto,
        detallesAdicionales: d.detallesAdicionales,
        impuestos: d.impuestos.map((imp) => ({
          codigo: imp.codigo,
          codigoPorcentaje: imp.codigoPorcentaje,
          tarifa: imp.tarifa,
          baseImponible: imp.baseImponible,
          valor: imp.valor,
        })),
      };
    });
  }

  private calculateTotalesNotaCredito(detalles: DetalleNotaCredito[]): {
    totalSinImpuestos: number;
    totalConImpuestos: TotalImpuesto[];
    valorModificacion: number;
  } {
    let totalSinImpuestos = new Decimal(0);
    const impuestosMap = new Map<
      string,
      {
        codigo: string;
        codigoPorcentaje: string;
        tarifa: number;
        baseImponible: Decimal;
        valor: Decimal;
      }
    >();

    detalles.forEach((detalle) => {
      totalSinImpuestos = totalSinImpuestos.plus(
        new Decimal(detalle.precioTotalSinImpuesto),
      );

      detalle.impuestos.forEach((imp) => {
        const key = `${imp.codigo}-${imp.codigoPorcentaje}`;
        const existing = impuestosMap.get(key);

        if (existing) {
          existing.baseImponible = existing.baseImponible.plus(
            new Decimal(imp.baseImponible),
          );
          existing.valor = existing.valor.plus(new Decimal(imp.valor));
        } else {
          impuestosMap.set(key, {
            codigo: imp.codigo,
            codigoPorcentaje: imp.codigoPorcentaje,
            tarifa: imp.tarifa,
            baseImponible: new Decimal(imp.baseImponible),
            valor: new Decimal(imp.valor),
          });
        }
      });
    });

    const totalConImpuestos: TotalImpuesto[] = Array.from(
      impuestosMap.values(),
    ).map((imp) => ({
      ...imp,
      baseImponible: imp.baseImponible.toDecimalPlaces(2).toNumber(),
      valor: imp.valor.toDecimalPlaces(2).toNumber(),
    }));

    const totalImpuestos = totalConImpuestos.reduce(
      (sum, imp) => sum.plus(new Decimal(imp.valor)),
      new Decimal(0),
    );
    const valorModificacion = totalSinImpuestos.plus(totalImpuestos);

    return {
      totalSinImpuestos: totalSinImpuestos.toDecimalPlaces(2).toNumber(),
      totalConImpuestos,
      valorModificacion: valorModificacion.toDecimalPlaces(2).toNumber(),
    };
  }

  mapResultToNotaCreditoResponse(
    result: SriOperationResult,
  ): NotaCreditoResponseDto {
    return {
      success: result.success,
      claveAcceso: result.claveAcceso,
      estado: result.estado,
      fechaAutorizacion: result.fechaAutorizacion,
      numeroAutorizacion: result.numeroAutorizacion,
      xmlAutorizado: result.xmlAutorizado,
      mensajes: result.mensajes,
    };
  }
}
