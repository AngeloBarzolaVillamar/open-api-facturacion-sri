import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaveAccesoService } from './clave-acceso.service';
import { XmlBuilderService } from './xml-builder.service';
import { XmlSignerService } from './xml-signer.service';
import { SriSoapClient } from './sri-soap.client';
import { SriRepositoryService } from './sri-repository.service';
import { XmlStorageService } from './xml-storage.service';
import { SriBaseService } from './sri-base.service';
import { CreateRetencionDto, RetencionResponseDto } from '../dto';
import {
  InfoTributaria,
  Retencion,
  InfoRetencion,
  ImpuestoRetenido,
  SriOperationResult,
} from '../interfaces';
import { TipoComprobante, Ambiente, TipoEmision } from '../constants';

@Injectable()
export class RetencionService {
  private readonly logger = new Logger(RetencionService.name);

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
   * Emite un Comprobante de Retención electrónico
   */
  async emitirRetencion(
    dto: CreateRetencionDto,
  ): Promise<RetencionResponseDto> {
    this.logger.log('Iniciando emisión de comprobante de retención');

    try {
      // Validar identificación del sujeto retenido
      this.base.validarIdentificacion(
        dto.sujetoRetenido.tipoIdentificacion,
        dto.sujetoRetenido.identificacion,
        'sujeto retenido',
      );

      // Validar tipo de identificación contra catálogo
      await this.base.validarTipoIdentificacionCatalogo(
        dto.sujetoRetenido.tipoIdentificacion,
      );

      // Validar códigos de retención contra catálogo
      await this.base.validarRetencionesCatalogo(dto.impuestos);

      // Validar documento sustento contra catálogo
      for (const imp of dto.impuestos) {
        await this.base.validarDocumentoSustentoCatalogo(imp.codDocSustento);
      }

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
        this.logger.log(`Usando secuencial RET proporcionado: ${secuencial}`);
      } else {
        if (!puntoEmisionInfo) {
          throw new BadRequestException(
            'Para auto-generar secuencial RET, el emisor debe estar registrado en la base de datos',
          );
        }
        const nextSecuencial = await this.repository.getNextSecuencial(
          puntoEmisionInfo.punto_emision_id,
          TipoComprobante.COMPROBANTE_RETENCION,
        );
        secuencial = nextSecuencial;
        this.logger.log(`Secuencial RET auto-generado: ${secuencial}`);
      }

      const [day, month, year] = dto.fechaEmision.split('/');
      const fechaEmision = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
      );

      const claveAcceso = this.claveAccesoService.generate({
        fechaEmision,
        tipoComprobante: TipoComprobante.COMPROBANTE_RETENCION,
        ruc: dto.emisor.ruc,
        ambiente,
        establecimiento: dto.emisor.establecimiento,
        puntoEmision: dto.emisor.puntoEmision,
        secuencial,
        tipoEmision,
      });

      this.logger.log(`Clave de acceso RET generada: ${claveAcceso}`);

      const retencion = this.buildRetencionFromDto(
        dto,
        claveAcceso,
        secuencial,
        ambiente,
        tipoEmision,
      );
      const xml = this.xmlBuilderService.buildRetencion(retencion);
      this.logger.log('XML de comprobante de retención generado');

      // Verify emisor has certificate in database
      if (!emisor || !emisor.certificado_p12) {
        throw new BadRequestException(
          `El emisor ${dto.emisor.ruc} no tiene certificado P12 configurado. ` +
            `Use el endpoint /certificates/upload-cert para subir el certificado.`,
        );
      }

      this.logger.log(
        `Firmando RET con certificado del emisor: ${emisor.certificado_nombre}`,
      );
      const xmlFirmado = await this.xmlSignerService.signXmlForEmisor(
        xml,
        dto.emisor.ruc,
      );
      this.logger.log('XML de comprobante de retención firmado con XAdES-BES');

      const resultado = await this.sriSoapClient.enviarYAutorizar(
        xmlFirmado,
        claveAcceso,
      );

      // Persistir en base de datos
      if (emisor && puntoEmisionInfo) {
        await this.persistirRetencion(
          dto,
          retencion,
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
        this.logger.warn('Emisor no encontrado en BD, retención no persistida');
      }

      return this.mapResultToRetencionResponse(resultado);
    } catch (error) {
      this.logger.error(
        `Error al emitir comprobante de retención: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Persists Retención and all related data to database
   */
  private async persistirRetencion(
    dto: CreateRetencionDto,
    retencion: Retencion,
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
            tipo_comprobante: TipoComprobante.COMPROBANTE_RETENCION,
            ambiente,
            tipo_emision: tipoEmision,
            secuencial,
            clave_acceso: claveAcceso,
            fecha_emision: dto.fechaEmision.split('/').reverse().join('-'),
            estado: resultado.success ? 'AUTORIZADO' : resultado.estado,
            estado_sri: resultado.estado,
            fecha_autorizacion: resultado.fechaAutorizacion,
            numero_autorizacion: resultado.numeroAutorizacion || claveAcceso,
            receptor_tipo_identificacion: dto.sujetoRetenido.tipoIdentificacion,
            receptor_identificacion: dto.sujetoRetenido.identificacion,
            receptor_razon_social: dto.sujetoRetenido.razonSocial,
            receptor_email: dto.sujetoRetenido.email,
          },
          client,
        );

        this.logger.log(`Retención creada con ID: ${comprobante.id}`);

        // 2. Create retenciones in comprobante_retenciones table
        if (retencion.impuestos && retencion.impuestos.length > 0) {
          for (const imp of retencion.impuestos) {
            await client.query(
              `INSERT INTO comprobante_retenciones 
               (comprobante_id, codigo, codigo_retencion, base_imponible, porcentaje_retener, valor_retenido, cod_doc_sustento, num_doc_sustento, fecha_emision_doc_sustento)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                comprobante.id,
                imp.codigo,
                imp.codigoRetencion,
                imp.baseImponible,
                imp.porcentajeRetener,
                imp.valorRetenido,
                imp.codDocSustento,
                imp.numDocSustento,
                imp.fechaEmisionDocSustento?.split('/').reverse().join('-'),
              ],
            );
          }
        }

        // 3. Save signed XML always (needed for retry), authorized only if authorized
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

        // 4. Create info adicional
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

        this.logger.log(`Retención ${claveAcceso} persistida correctamente`);
      });
    } catch (error) {
      this.logger.error(
        `CRÍTICO: RET ${claveAcceso} autorizada por SRI pero NO persistida: ${(error as Error).message}`,
      );
      this.eventEmitter.emit('comprobante.persistencia_fallida', {
        claveAcceso,
        emisorRuc: dto.emisor.ruc,
        tipoComprobante: TipoComprobante.COMPROBANTE_RETENCION,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Construye objeto Retencion desde el DTO
   */
  private buildRetencionFromDto(
    dto: CreateRetencionDto,
    claveAcceso: string,
    secuencial: string,
    ambiente: Ambiente,
    tipoEmision: TipoEmision,
  ): Retencion {
    const infoTributaria: InfoTributaria = {
      ambiente,
      tipoEmision,
      razonSocial: dto.emisor.razonSocial,
      nombreComercial: dto.emisor.nombreComercial,
      ruc: dto.emisor.ruc,
      claveAcceso,
      codDoc: TipoComprobante.COMPROBANTE_RETENCION,
      estab: dto.emisor.establecimiento.padStart(3, '0'),
      ptoEmi: dto.emisor.puntoEmision.padStart(3, '0'),
      secuencial: secuencial.padStart(9, '0'),
      dirMatriz: dto.emisor.dirMatriz,
      agenteRetencion: dto.emisor.agenteRetencion,
      contribuyenteRimpe: dto.emisor.contribuyenteRimpe,
    };

    const infoCompRetencion: InfoRetencion = {
      fechaEmision: dto.fechaEmision,
      dirEstablecimiento: dto.emisor.dirEstablecimiento,
      contribuyenteEspecial: dto.emisor.contribuyenteEspecial,
      obligadoContabilidad: dto.emisor.obligadoContabilidad,
      tipoIdentificacionSujetoRetenido: dto.sujetoRetenido
        .tipoIdentificacion as any,
      tipoSujetoRetenido: dto.sujetoRetenido.tipoSujetoRetenido,
      razonSocialSujetoRetenido: dto.sujetoRetenido.razonSocial,
      identificacionSujetoRetenido: dto.sujetoRetenido.identificacion,
      periodoFiscal: dto.periodoFiscal,
    };

    const impuestos: ImpuestoRetenido[] = dto.impuestos.map((imp) => ({
      codigo: imp.codigo,
      codigoRetencion: imp.codigoRetencion,
      baseImponible: imp.baseImponible,
      porcentajeRetener: imp.porcentajeRetener,
      valorRetenido: imp.valorRetenido,
      codDocSustento: imp.codDocSustento,
      codSustento: imp.codSustento,
      numDocSustento: imp.numDocSustento,
      fechaEmisionDocSustento: imp.fechaEmisionDocSustento,
      totalSinImpuestos: imp.totalSinImpuestos,
      importeTotal: imp.importeTotal,
      pagoLocExt: imp.pagoLocExt,
      formaPago: imp.formaPago,
      impuestosDocSustento: imp.impuestosDocSustento.map((impDoc) => ({
        codImpuestoDocSustento: impDoc.codImpuestoDocSustento,
        codigoPorcentaje: impDoc.codigoPorcentaje,
        baseImponible: impDoc.baseImponible,
        tarifa: impDoc.tarifa,
        valorImpuesto: impDoc.valorImpuesto,
      })),
    }));

    const retencion: Retencion = {
      infoTributaria,
      infoCompRetencion,
      impuestos,
    };

    // Información adicional
    const infoAdicional: any[] = [];

    if (dto.sujetoRetenido.email) {
      infoAdicional.push({ nombre: 'email', valor: dto.sujetoRetenido.email });
    }
    if (dto.sujetoRetenido.direccion) {
      infoAdicional.push({
        nombre: 'direccion',
        valor: dto.sujetoRetenido.direccion,
      });
    }

    if (dto.infoAdicional) {
      infoAdicional.push(...dto.infoAdicional);
    }

    if (infoAdicional.length > 0) {
      retencion.infoAdicional = infoAdicional;
    }

    return retencion;
  }

  mapResultToRetencionResponse(
    result: SriOperationResult,
  ): RetencionResponseDto {
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
