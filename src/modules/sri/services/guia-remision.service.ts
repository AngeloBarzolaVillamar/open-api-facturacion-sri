import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaveAccesoService } from './clave-acceso.service';
import { XmlBuilderService } from './xml-builder.service';
import { XmlSignerService } from './xml-signer.service';
import { SriSoapClient } from './sri-soap.client';
import { SriRepositoryService } from './sri-repository.service';
import { XmlStorageService } from './xml-storage.service';
import { SriBaseService } from './sri-base.service';
import { CreateGuiaRemisionDto, GuiaRemisionResponseDto } from '../dto';
import {
  InfoTributaria,
  GuiaRemision,
  InfoGuiaRemision,
  DestinatarioGuiaRemision,
  SriOperationResult,
} from '../interfaces';
import { TipoComprobante, Ambiente, TipoEmision } from '../constants';

@Injectable()
export class GuiaRemisionService {
  private readonly logger = new Logger(GuiaRemisionService.name);

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
   * Emite una Guía de Remisión electrónica
   */
  async emitirGuiaRemision(
    dto: CreateGuiaRemisionDto,
  ): Promise<GuiaRemisionResponseDto> {
    this.logger.log('Iniciando emisión de guía de remisión');

    try {
      // Validar identificación del transportista
      this.base.validarIdentificacion(
        dto.tipoIdentificacionTransportista,
        dto.rucTransportista,
        'transportista',
      );

      // Validar tipo de identificación del transportista contra catálogo
      await this.base.validarTipoIdentificacionCatalogo(
        dto.tipoIdentificacionTransportista,
      );

      // Validar identificación de los destinatarios
      for (const dest of dto.destinatarios) {
        this.base.validarIdentificacion(
          '05', // Asumimos cédula por defecto
          dest.identificacionDestinatario,
          'destinatario',
        );
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
        this.logger.log(`Usando secuencial GR proporcionado: ${secuencial}`);
      } else {
        if (!puntoEmisionInfo) {
          throw new BadRequestException(
            'Para auto-generar secuencial GR, el emisor debe estar registrado en la base de datos',
          );
        }
        const nextSecuencial = await this.repository.getNextSecuencial(
          puntoEmisionInfo.punto_emision_id,
          TipoComprobante.GUIA_REMISION,
        );
        secuencial = nextSecuencial;
        this.logger.log(`Secuencial GR auto-generado: ${secuencial}`);
      }

      const [day, month, year] = dto.fechaIniTransporte.split('/');
      const fechaEmision = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
      );

      const claveAcceso = this.claveAccesoService.generate({
        fechaEmision,
        tipoComprobante: TipoComprobante.GUIA_REMISION,
        ruc: dto.emisor.ruc,
        ambiente,
        establecimiento: dto.emisor.establecimiento,
        puntoEmision: dto.emisor.puntoEmision,
        secuencial,
        tipoEmision,
      });

      this.logger.log(`Clave de acceso GR generada: ${claveAcceso}`);

      const guiaRemision = this.buildGuiaRemisionFromDto(
        dto,
        claveAcceso,
        secuencial,
        ambiente,
        tipoEmision,
      );
      const xml = this.xmlBuilderService.buildGuiaRemision(guiaRemision);
      this.logger.log('XML de guía de remisión generado');

      // Verify emisor has certificate in database
      if (!emisor || !emisor.certificado_p12) {
        throw new BadRequestException(
          `El emisor ${dto.emisor.ruc} no tiene certificado P12 configurado. ` +
            `Use el endpoint /certificates/upload-cert para subir el certificado.`,
        );
      }

      this.logger.log(
        `Firmando GR con certificado del emisor: ${emisor.certificado_nombre}`,
      );
      const xmlFirmado = await this.xmlSignerService.signXmlForEmisor(
        xml,
        dto.emisor.ruc,
      );
      this.logger.log('XML de guía de remisión firmado con XAdES-BES');

      const resultado = await this.sriSoapClient.enviarYAutorizar(
        xmlFirmado,
        claveAcceso,
      );

      // Persistir en base de datos
      if (emisor && puntoEmisionInfo) {
        await this.persistirGuiaRemision(
          dto,
          guiaRemision,
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
          'Emisor no encontrado en BD, guía de remisión no persistida',
        );
      }

      return this.mapResultToGuiaRemisionResponse(resultado);
    } catch (error) {
      this.logger.error(
        `Error al emitir guía de remisión: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Persists Guía de Remisión and all related data to database
   */
  private async persistirGuiaRemision(
    dto: CreateGuiaRemisionDto,
    guiaRemision: GuiaRemision,
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
            tipo_comprobante: TipoComprobante.GUIA_REMISION,
            ambiente,
            tipo_emision: tipoEmision,
            secuencial,
            clave_acceso: claveAcceso,
            fecha_emision: dto.fechaIniTransporte
              .split('/')
              .reverse()
              .join('-'),
            estado: resultado.success ? 'AUTORIZADO' : resultado.estado,
            estado_sri: resultado.estado,
            fecha_autorizacion: resultado.fechaAutorizacion,
            numero_autorizacion: resultado.numeroAutorizacion || claveAcceso,
            // Campos específicos de Guía de Remisión
            dir_partida: dto.dirPartida,
            placa: dto.placa,
            ruc_transportista: dto.rucTransportista,
            razon_social_transportista: dto.razonSocialTransportista,
            tipo_identificacion_transportista:
              dto.tipoIdentificacionTransportista,
            fecha_ini_transporte: dto.fechaIniTransporte
              .split('/')
              .reverse()
              .join('-'),
            fecha_fin_transporte: dto.fechaFinTransporte
              .split('/')
              .reverse()
              .join('-'),
          },
          client,
        );

        this.logger.log(`Guía de Remisión creada con ID: ${comprobante.id}`);

        // 2. Create destinatarios and their detalles
        for (const dest of dto.destinatarios) {
          // Insert destinatario
          const destResult = await client.query(
            `INSERT INTO guia_destinatarios 
             (comprobante_id, tipo_identificacion_destinatario, identificacion_destinatario, razon_social_destinatario, 
              dir_destinatario, email_destinatario, motivo_traslado, cod_doc_sustento, num_doc_sustento, fecha_emision_doc_sustento)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              comprobante.id,
              dest.tipoIdentificacionDestinatario,
              dest.identificacionDestinatario,
              dest.razonSocialDestinatario,
              dest.dirDestinatario,
              dest.emailDestinatario,
              dest.motivoTraslado,
              dest.codDocSustento,
              dest.numDocSustento,
              dest.fechaEmisionDocSustento?.split('/').reverse().join('-'),
            ],
          );
          const destinatarioId = destResult.rows[0].id;

          // Insert detalles for this destinatario
          for (const det of dest.detalles) {
            await client.query(
              `INSERT INTO guia_detalles 
               (destinatario_id, codigo_interno, codigo_adicional, descripcion, cantidad)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                destinatarioId,
                det.codigoInterno,
                det.codigoAdicional,
                det.descripcion,
                det.cantidad,
              ],
            );
          }
        }

        // 3. Save signed XML always (needed for retry), authorized only if authorized
        const fechaEmision = new Date(
          parseInt(dto.fechaIniTransporte.split('/')[2]),
          parseInt(dto.fechaIniTransporte.split('/')[1]) - 1,
          parseInt(dto.fechaIniTransporte.split('/')[0]),
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

        this.logger.log(
          `Guía de Remisión ${claveAcceso} persistida correctamente`,
        );
      });
    } catch (error) {
      this.logger.error(
        `CRÍTICO: GR ${claveAcceso} autorizada por SRI pero NO persistida: ${(error as Error).message}`,
      );
      this.eventEmitter.emit('comprobante.persistencia_fallida', {
        claveAcceso,
        emisorRuc: dto.emisor.ruc,
        tipoComprobante: TipoComprobante.GUIA_REMISION,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Construye objeto GuiaRemision desde el DTO
   */
  private buildGuiaRemisionFromDto(
    dto: CreateGuiaRemisionDto,
    claveAcceso: string,
    secuencial: string,
    ambiente: Ambiente,
    tipoEmision: TipoEmision,
  ): GuiaRemision {
    const infoTributaria: InfoTributaria = {
      ambiente,
      tipoEmision,
      razonSocial: dto.emisor.razonSocial,
      nombreComercial: dto.emisor.nombreComercial,
      ruc: dto.emisor.ruc,
      claveAcceso,
      codDoc: TipoComprobante.GUIA_REMISION,
      estab: dto.emisor.establecimiento.padStart(3, '0'),
      ptoEmi: dto.emisor.puntoEmision.padStart(3, '0'),
      secuencial: secuencial.padStart(9, '0'),
      dirMatriz: dto.emisor.dirMatriz,
      agenteRetencion: dto.emisor.agenteRetencion,
      contribuyenteRimpe: dto.emisor.contribuyenteRimpe,
    };

    const infoGuiaRemision: InfoGuiaRemision = {
      dirEstablecimiento: dto.emisor.dirEstablecimiento,
      dirPartida: dto.dirPartida,
      razonSocialTransportista: dto.razonSocialTransportista,
      tipoIdentificacionTransportista:
        dto.tipoIdentificacionTransportista as any,
      rucTransportista: dto.rucTransportista,
      obligadoContabilidad: dto.emisor.obligadoContabilidad,
      contribuyenteEspecial: dto.emisor.contribuyenteEspecial,
      fechaIniTransporte: dto.fechaIniTransporte,
      fechaFinTransporte: dto.fechaFinTransporte,
      placa: dto.placa,
    };

    const destinatarios: DestinatarioGuiaRemision[] = dto.destinatarios.map(
      (dest) => ({
        tipoIdentificacionDestinatario: dest.tipoIdentificacionDestinatario,
        identificacionDestinatario: dest.identificacionDestinatario,
        razonSocialDestinatario: dest.razonSocialDestinatario,
        dirDestinatario: dest.dirDestinatario,
        emailDestinatario: dest.emailDestinatario,
        motivoTraslado: dest.motivoTraslado,
        docAduaneroUnico: dest.docAduaneroUnico,
        codEstabDestino: dest.codEstabDestino,
        ruta: dest.ruta,
        codDocSustento: dest.codDocSustento,
        numDocSustento: dest.numDocSustento,
        numAutDocSustento: dest.numAutDocSustento,
        fechaEmisionDocSustento: dest.fechaEmisionDocSustento,
        detalles: dest.detalles.map((det) => ({
          codigoInterno: det.codigoInterno,
          codigoAdicional: det.codigoAdicional,
          descripcion: det.descripcion,
          cantidad: det.cantidad,
          detallesAdicionales: det.detallesAdicionales,
        })),
      }),
    );

    const guiaRemision: GuiaRemision = {
      infoTributaria,
      infoGuiaRemision,
      destinatarios,
    };

    // Información adicional
    if (dto.infoAdicional && dto.infoAdicional.length > 0) {
      guiaRemision.infoAdicional = dto.infoAdicional;
    }

    return guiaRemision;
  }

  mapResultToGuiaRemisionResponse(
    result: SriOperationResult,
  ): GuiaRemisionResponseDto {
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
