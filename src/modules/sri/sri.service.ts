import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { extractRucFromClaveAcceso } from './utils/clave-acceso.utils';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SriSoapClient,
  FacturaService,
  NotaCreditoService,
  NotaDebitoService,
  RetencionService,
  GuiaRemisionService,
  XmlBuilderService,
} from './services';
import { SriRepositoryService } from './services/sri-repository.service';
import { XmlStorageService } from './services/xml-storage.service';
import {
  CreateFacturaDto,
  FacturaResponseDto,
  CreateNotaCreditoDto,
  NotaCreditoResponseDto,
  CreateNotaDebitoDto,
  NotaDebitoResponseDto,
  CreateRetencionDto,
  RetencionResponseDto,
  CreateGuiaRemisionDto,
  GuiaRemisionResponseDto,
  EmisionEncoladaResponseDto,
} from './dto';
import { TIPO_COMPROBANTE_DESCRIPCIONES } from './constants';

@Injectable()
export class SriService {
  private readonly logger = new Logger(SriService.name);

  constructor(
    private readonly sriSoapClient: SriSoapClient,
    private readonly repository: SriRepositoryService,
    private readonly xmlStorage: XmlStorageService,
    private readonly facturaService: FacturaService,
    private readonly notaCreditoService: NotaCreditoService,
    private readonly notaDebitoService: NotaDebitoService,
    private readonly retencionService: RetencionService,
    private readonly guiaRemisionService: GuiaRemisionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly xmlBuilder: XmlBuilderService,
    @InjectQueue('sri-emision') private readonly emisionQueue: Queue,
  ) {}

  // ==========================================
  // FACTURA — Delegado a FacturaService
  // ==========================================

  async emitirFactura(dto: CreateFacturaDto): Promise<EmisionEncoladaResponseDto | FacturaResponseDto> {
    const isAsync = this.configService.get<string>('SRI_EMISION_ASYNC') !== 'false';
    if (!isAsync) {
      return this.facturaService.emitirFactura(dto);
    }
    const job = await this.emisionQueue.add('emision', { tipo: 'FACTURA', dto });
    this.logger.log(`Factura encolada con Job ID: ${job.id}`);
    return {
      mensaje: 'Factura encolada para emisión asíncrona',
      jobId: job.id!,
      estado: 'EN_COLA',
    };
  }

  generarXmlPreview(dto: CreateFacturaDto): string {
    return this.facturaService.generarXmlPreview(dto);
  }

  async generarFacturaFirmadaDebug(dto: CreateFacturaDto): Promise<{
    claveAcceso: string;
    xmlSinFirma: string;
    xmlFirmado: string;
  }> {
    return this.facturaService.generarFacturaFirmadaDebug(dto);
  }

  // ==========================================
  // NOTA DE CRÉDITO — Delegado a NotaCreditoService
  // ==========================================

  async emitirNotaCredito(
    dto: CreateNotaCreditoDto,
  ): Promise<EmisionEncoladaResponseDto | NotaCreditoResponseDto> {
    const isAsync = this.configService.get<string>('SRI_EMISION_ASYNC') !== 'false';
    if (!isAsync) {
      return this.notaCreditoService.emitirNotaCredito(dto);
    }
    const job = await this.emisionQueue.add('emision', { tipo: 'NOTA_CREDITO', dto });
    this.logger.log(`Nota de crédito encolada con Job ID: ${job.id}`);
    return {
      mensaje: 'Nota de crédito encolada para emisión asíncrona',
      jobId: job.id!,
      estado: 'EN_COLA',
    };
  }

  // ==========================================
  // NOTA DE DÉBITO — Delegado a NotaDebitoService
  // ==========================================

  async emitirNotaDebito(
    dto: CreateNotaDebitoDto,
  ): Promise<EmisionEncoladaResponseDto | NotaDebitoResponseDto> {
    const isAsync = this.configService.get<string>('SRI_EMISION_ASYNC') !== 'false';
    if (!isAsync) {
      return this.notaDebitoService.emitirNotaDebito(dto);
    }
    const job = await this.emisionQueue.add('emision', { tipo: 'NOTA_DEBITO', dto });
    this.logger.log(`Nota de débito encolada con Job ID: ${job.id}`);
    return {
      mensaje: 'Nota de débito encolada para emisión asíncrona',
      jobId: job.id!,
      estado: 'EN_COLA',
    };
  }

  // ==========================================
  // RETENCIÓN — Delegado a RetencionService
  // ==========================================

  async emitirRetencion(
    dto: CreateRetencionDto,
  ): Promise<EmisionEncoladaResponseDto | RetencionResponseDto> {
    const isAsync = this.configService.get<string>('SRI_EMISION_ASYNC') !== 'false';
    if (!isAsync) {
      return this.retencionService.emitirRetencion(dto);
    }
    const job = await this.emisionQueue.add('emision', { tipo: 'RETENCION', dto });
    this.logger.log(`Retención encolada con Job ID: ${job.id}`);
    return {
      mensaje: 'Retención encolada para emisión asíncrona',
      jobId: job.id!,
      estado: 'EN_COLA',
    };
  }

  // ==========================================
  // GUÍA DE REMISIÓN — Delegado a GuiaRemisionService
  // ==========================================

  async emitirGuiaRemision(
    dto: CreateGuiaRemisionDto,
  ): Promise<EmisionEncoladaResponseDto | GuiaRemisionResponseDto> {
    const isAsync = this.configService.get<string>('SRI_EMISION_ASYNC') !== 'false';
    if (!isAsync) {
      return this.guiaRemisionService.emitirGuiaRemision(dto);
    }
    const job = await this.emisionQueue.add('emision', { tipo: 'GUIA_REMISION', dto });
    this.logger.log(`Guía de remisión encolada con Job ID: ${job.id}`);
    return {
      mensaje: 'Guía de remisión encolada para emisión asíncrona',
      jobId: job.id!,
      estado: 'EN_COLA',
    };
  }

  // ==========================================
  // AUTORIZACIÓN Y VALIDACIÓN
  // ==========================================

  /**
   * Consulta el estado de autorización de un comprobante en el SRI
   */
  async consultarAutorizacion(
    claveAcceso: string,
  ): Promise<FacturaResponseDto> {
    const response = await this.sriSoapClient.autorizarComprobante(claveAcceso);

    if (response.autorizaciones && response.autorizaciones.autorizacion) {
      const auth = Array.isArray(response.autorizaciones.autorizacion)
        ? response.autorizaciones.autorizacion[0]
        : response.autorizaciones.autorizacion;

      return {
        success: auth.estado === 'AUTORIZADO',
        claveAcceso,
        estado: auth.estado,
        fechaAutorizacion: auth.fechaAutorizacion,
        numeroAutorizacion: auth.numeroAutorizacion,
        xmlAutorizado: auth.comprobante,
        mensajes: auth.mensajes?.mensaje
          ? Array.isArray(auth.mensajes.mensaje)
            ? auth.mensajes.mensaje
            : [auth.mensajes.mensaje]
          : [],
      };
    }

    return {
      success: false,
      claveAcceso,
      estado: 'NO ENCONTRADO',
      mensajes: [
        {
          identificador: '404',
          mensaje: 'No se encontró el comprobante',
          tipo: 'ADVERTENCIA',
        },
      ],
    };
  }

  /**
   * Valida la estructura de un XML firmado
   */
  async validarXml(
    xmlFirmado: string,
  ): Promise<{ valido: boolean; errores: string[] }> {
    const errores: string[] = [];

    if (!xmlFirmado || typeof xmlFirmado !== 'string') {
      return {
        valido: false,
        errores: [
          'El XML proporcionado está vacío o no es una cadena de texto válida.',
        ],
      };
    }

    // 1. Verificar que es XML parseable usando xmlBuilder
    try {
      await this.xmlBuilder.parseXml(xmlFirmado);
    } catch (e) {
      errores.push(`XML malformado: ${(e as Error).message}`);
      return { valido: false, errores };
    }

    // 2. Verificar tipo de comprobante
    const tiposValidos = [
      '<factura',
      '<notaCredito',
      '<notaDebito',
      '<comprobanteRetencion',
      '<guiaRemision',
    ];
    if (!tiposValidos.some((t) => xmlFirmado.includes(t))) {
      errores.push('El XML no contiene un tipo de comprobante válido');
    }

    // 3. Verificar firma digital
    if (!xmlFirmado.includes('<ds:Signature')) {
      errores.push('El XML no contiene firma digital XAdES-BES');
    }

    // 4. Verificar clave de acceso de 49 dígitos
    if (!xmlFirmado.match(/<claveAcceso>(\d{49})<\/claveAcceso>/)) {
      errores.push('No se encontró una clave de acceso válida de 49 dígitos');
    }

    return {
      valido: errores.length === 0,
      errores,
    };
  }

  // ==========================================
  // CONSULTA DE COMPROBANTES
  // ==========================================

  /**
   * Lista comprobantes con filtros y paginación
   */
  async listarComprobantes(filters: {
    rucEmisor?: string;
    emisorIds?: string[];
    identificacionComprador?: string;
    tipoComprobante?: string;
    estado?: string;
    estados?: string[];
    fechaDesde?: string;
    fechaHasta?: string;
    establecimiento?: string;
    puntoEmision?: string;
    page?: number;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: any[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = filters.offset;

    const result = await this.repository.findComprobantes({
      ...filters,
      page: offset !== undefined ? Math.floor(offset / limit) + 1 : page,
      limit,
    });

    const data = result.data.map((c) => ({
      id: c.id,
      emisorId: c.emisor_id,
      claveAcceso: c.clave_acceso,
      tipoComprobante: c.tipo_comprobante,
      tipoComprobanteDescripcion:
        TIPO_COMPROBANTE_DESCRIPCIONES[c.tipo_comprobante] ||
        c.tipo_comprobante,
      ambiente: c.ambiente,
      fechaEmision: c.fecha_emision,
      establecimiento: c.establecimiento,
      puntoEmision: c.punto_emision,
      secuencial: c.secuencial,
      rucEmisor: c.ruc_emisor,
      razonSocialEmisor: c.razon_social_emisor,
      identificacionComprador: c.identificacion_comprador,
      razonSocialComprador: c.razon_social_comprador,
      subtotal: parseFloat(c.subtotal) || 0,
      totalImpuestos: parseFloat(c.total_impuestos) || 0,
      total: parseFloat(c.total) || 0,
      estado: c.estado,
      fechaAutorizacion: c.fecha_autorizacion,
      numAutorizacion: c.num_autorizacion,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return {
      data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  /**
   * Obtiene un comprobante por clave de acceso con sus detalles
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async obtenerComprobante(claveAcceso: string): Promise<any> {
    const comprobante =
      await this.repository.findComprobanteConDetalles(claveAcceso);
    if (!comprobante) {
      return null;
    }

    const detalles = await this.repository.findDetallesByComprobanteId(
      comprobante.id,
    );
    const infoAdicional =
      await this.repository.findInfoAdicionalByComprobanteId(comprobante.id);

    return {
      id: comprobante.id,
      claveAcceso: comprobante.clave_acceso,
      tipoComprobante: comprobante.tipo_comprobante,
      tipoComprobanteDescripcion:
        TIPO_COMPROBANTE_DESCRIPCIONES[comprobante.tipo_comprobante] ||
        comprobante.tipo_comprobante,
      ambiente: comprobante.ambiente,
      fechaEmision: comprobante.fecha_emision,
      establecimiento: comprobante.establecimiento,
      puntoEmision: comprobante.punto_emision,
      secuencial: comprobante.secuencial,
      rucEmisor: comprobante.ruc_emisor,
      razonSocialEmisor: comprobante.razon_social_emisor,
      identificacionComprador: comprobante.identificacion_comprador,
      razonSocialComprador: comprobante.razon_social_comprador,
      subtotal: parseFloat(comprobante.subtotal) || 0,
      totalImpuestos: parseFloat(comprobante.total_impuestos) || 0,
      total: parseFloat(comprobante.total) || 0,
      estado: comprobante.estado,
      fechaAutorizacion: comprobante.fecha_autorizacion,
      numAutorizacion: comprobante.num_autorizacion,
      createdAt: comprobante.created_at,
      updatedAt: comprobante.updated_at,
      detalles: detalles.map((d) => ({
        id: d.id,
        codigoPrincipal: d.codigo_principal,
        descripcion: d.descripcion,
        cantidad: parseFloat(d.cantidad) || 0,
        precioUnitario: parseFloat(d.precio_unitario) || 0,
        descuento: parseFloat(d.descuento) || 0,
        subtotal: parseFloat(d.subtotal) || 0,
      })),
      infoAdicional,
      xmlDisponible: comprobante.xml_disponible,
    };
  }

  /**
   * Obtiene el XML autorizado de un comprobante
   */
  async obtenerXmlAutorizado(claveAcceso: string): Promise<string | null> {
    const comprobante =
      await this.repository.findComprobanteByClaveAcceso(claveAcceso);
    if (!comprobante || !comprobante.id) {
      return null;
    }
    const xmlPath = await this.repository.findXmlAutorizado(comprobante.id);
    if (!xmlPath) {
      return null;
    }
    // Read XML content from file
    return this.xmlStorage.readXml(xmlPath);
  }

  /**
   * Anula un comprobante que NO ha sido autorizado por el SRI
   * Solo permite anular comprobantes con estado diferente a AUTORIZADO
   */
  async anularComprobante(
    claveAcceso: string,
  ): Promise<{ message: string; claveAcceso: string; estadoAnterior: string }> {
    const comprobante =
      await this.repository.findComprobanteByClaveAcceso(claveAcceso);

    if (!comprobante) {
      throw new BadRequestException(`Comprobante ${claveAcceso} no encontrado`);
    }

    const estadoActual = comprobante.estado;

    // No permitir anular comprobantes autorizados
    if (estadoActual === 'AUTORIZADO') {
      throw new BadRequestException(
        'No se puede anular un comprobante que ya fue AUTORIZADO por el SRI. ' +
          'Para anular comprobantes autorizados, debe emitir una Nota de Crédito.',
      );
    }

    // No permitir anular si ya está anulado
    if (estadoActual === 'ANULADO') {
      throw new BadRequestException('El comprobante ya está ANULADO');
    }

    // Actualizar estado a ANULADO
    await this.repository.updateComprobante(comprobante.id as string, {
      estado: 'ANULADO',
      estado_sri: 'ANULADO',
    });

    this.logger.log(
      `Comprobante ${claveAcceso} anulado. Estado anterior: ${estadoActual}`,
    );

    return {
      message: 'Comprobante anulado exitosamente',
      claveAcceso,
      estadoAnterior: estadoActual,
    };
  }

  /**
   * Reintenta enviar un comprobante DEVUELTA al SRI
   * Lee el XML firmado guardado y lo reenvía
   */
  async reintentarComprobante(claveAcceso: string): Promise<{
    claveAcceso: string;
    estado: string;
    fechaAutorizacion?: string;
    mensaje: string;
    errores?: string[];
  }> {
    const comprobante =
      await this.repository.findComprobanteByClaveAcceso(claveAcceso);

    if (!comprobante) {
      throw new BadRequestException(`Comprobante ${claveAcceso} no encontrado`);
    }

    const estadoActual = comprobante.estado;

    // Solo permitir reintentar si está DEVUELTA o RECHAZADO
    const estadosReintentables = [
      'DEVUELTA',
      'RECHAZADO',
      'PENDIENTE',
      'EN_PROCESO',
    ];
    if (!estadosReintentables.includes(estadoActual)) {
      throw new BadRequestException(
        `No se puede reintentar un comprobante con estado ${estadoActual}. ` +
          `Solo se pueden reintentar comprobantes con estado: ${estadosReintentables.join(', ')}`,
      );
    }

    // Obtener path del XML firmado desde la BD
    const xmlRecord = await this.repository.findXmlByComprobanteId(
      comprobante.id!,
    );

    if (!xmlRecord?.xml_firmado_path) {
      throw new BadRequestException(
        `No existe registro de XML firmado para el comprobante ${claveAcceso}. ` +
          `El comprobante no puede ser reenviado.`,
      );
    }

    // Normalizar path para cross-platform (Windows/Linux)
    const xmlFirmadoPath = xmlRecord.xml_firmado_path.replace(/\\/g, '/');
    const xmlFirmado = this.xmlStorage.readXml(xmlFirmadoPath);

    if (!xmlFirmado) {
      throw new BadRequestException(
        `No se encontró el archivo XML firmado en: ${xmlFirmadoPath}. ` +
          `El archivo puede haber sido eliminado.`,
      );
    }

    this.logger.log(`Reenviando comprobante ${claveAcceso} al SRI`);

    // Reenviar al SRI
    const resultado = await this.sriSoapClient.enviarYAutorizar(
      xmlFirmado,
      claveAcceso,
    );

    // Actualizar estado del comprobante
    const esAutorizado = resultado.success && resultado.estado === 'AUTORIZADO';
    const nuevoEstado = esAutorizado ? 'AUTORIZADO' : resultado.estado;

    await this.repository.updateComprobante(comprobante.id as string, {
      estado: nuevoEstado,
      estado_sri: resultado.estado,
      fecha_autorizacion: resultado.fechaAutorizacion,
      numero_autorizacion: resultado.numeroAutorizacion,
    });

    // Si fue autorizado, guardar XML autorizado
    if (esAutorizado && resultado.xmlAutorizado) {
      // Extraer datos para guardar el XML
      const rucEmisor = extractRucFromClaveAcceso(claveAcceso);
      const fecha = new Date(comprobante.fecha_emision);

      const autorizadoPath = this.xmlStorage.saveXml(
        rucEmisor,
        claveAcceso,
        fecha,
        'autorizado',
        resultado.xmlAutorizado,
      );
      await this.repository.saveXml({
        comprobante_id: comprobante.id as string,
        xml_autorizado_path: autorizadoPath,
      });
    }

    this.logger.log(
      `Comprobante ${claveAcceso} reenviado. Nuevo estado: ${nuevoEstado}`,
    );

    // Convert mensajes to string array
    const errores = resultado.mensajes.map(
      (m) =>
        `[${m.tipo}] ${m.identificador}: ${m.mensaje}${m.informacionAdicional ? ` - ${m.informacionAdicional}` : ''}`,
    );

    return {
      claveAcceso,
      estado: nuevoEstado,
      fechaAutorizacion: resultado.fechaAutorizacion,
      mensaje: esAutorizado
        ? 'Comprobante autorizado exitosamente'
        : `Comprobante ${nuevoEstado.toLowerCase()}`,
      errores: errores.length > 0 ? errores : undefined,
    };
  }

  /**
   * Verifica el estado de un comprobante directamente en el SRI
   * NO modifica la BD local, solo consulta
   */
  async verificarEnSri(claveAcceso: string): Promise<{
    claveAcceso: string;
    existeEnSri: boolean;
    estado: string;
    fechaAutorizacion?: string;
    numeroAutorizacion?: string;
    mensajes?: string[];
    estadoLocal?: string;
    sincronizado: boolean;
  }> {
    if (claveAcceso.length !== 49) {
      throw new BadRequestException('La clave de acceso debe tener 49 dígitos');
    }

    // 1. Consultar estado en nuestra BD
    const comprobanteLocal =
      await this.repository.findComprobanteByClaveAcceso(claveAcceso);
    const estadoLocal = comprobanteLocal?.estado;

    // 2. Consultar directamente al SRI
    this.logger.log(`Consultando estado en SRI para: ${claveAcceso}`);
    const respuestaSri =
      await this.sriSoapClient.autorizarComprobante(claveAcceso);

    // 3. Analizar respuesta del SRI
    let existeEnSri = false;
    let estadoSri = 'NO EXISTE';
    let fechaAutorizacion: string | undefined;
    let numeroAutorizacion: string | undefined;
    let mensajes: string[] = [];

    if (
      respuestaSri.autorizaciones &&
      respuestaSri.autorizaciones.autorizacion
    ) {
      existeEnSri = true;
      const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
        ? respuestaSri.autorizaciones.autorizacion[0]
        : respuestaSri.autorizaciones.autorizacion;

      estadoSri = auth.estado || 'DESCONOCIDO';
      fechaAutorizacion = auth.fechaAutorizacion;
      numeroAutorizacion = auth.numeroAutorizacion;

      // Extraer mensajes si los hay
      if (auth.mensajes?.mensaje) {
        const msgs = Array.isArray(auth.mensajes.mensaje)
          ? auth.mensajes.mensaje
          : [auth.mensajes.mensaje];
        mensajes = msgs.map(
          (m: any) =>
            `[${m.tipo || 'INFO'}] ${m.identificador || ''}: ${m.mensaje || ''}`,
        );
      }
    }

    // 4. Determinar si está sincronizado
    const sincronizado =
      estadoLocal === estadoSri ||
      (estadoLocal === 'AUTORIZADO' && estadoSri === 'AUTORIZADO');

    this.logger.log(
      `Estado SRI: ${estadoSri}, Estado Local: ${estadoLocal || 'No existe'}, Sincronizado: ${sincronizado}`,
    );

    return {
      claveAcceso,
      existeEnSri,
      estado: estadoSri,
      fechaAutorizacion,
      numeroAutorizacion,
      mensajes: mensajes.length > 0 ? mensajes : undefined,
      estadoLocal: estadoLocal || undefined,
      sincronizado,
    };
  }

  /**
   * Sincroniza comprobantes pendientes con el SRI
   * Flujo inteligente:
   * 1. Consulta SRI primero (evita duplicados)
   * 2. Si AUTORIZADO en SRI → actualiza BD local
   * 3. Si NO EXISTE en SRI y reintentar=true → reenvía XML firmado
   */
  async sincronizarConSri(options: {
    estados?: string[];
    reintentar?: boolean;
    limite?: number;
  }): Promise<{
    procesados: number;
    actualizados: number;
    reintentados: number;
    errores: number;
    detalle: Array<{
      claveAcceso: string;
      estadoAnterior: string;
      estadoSri: string;
      accion: string;
    }>;
  }> {
    const estados = options.estados || ['PENDIENTE', 'EN_PROCESO', 'DEVUELTA'];
    const reintentar = options.reintentar || false;
    const limiteGlobal = Math.min(
      options.limite || 200,
      this.configService.get<number>('SRI_SYNC_MAX_LIMIT', 500),
    );
    const BATCH_SIZE = 50;

    this.logger.log(
      `Sincronizando comprobantes con estados: ${estados.join(', ')}, reintentar: ${reintentar}, limite: ${limiteGlobal}`,
    );

    const detalle: Array<{
      claveAcceso: string;
      estadoAnterior: string;
      estadoSri: string;
      accion: string;
    }> = [];
    let actualizados = 0;
    let reintentados = 0;
    let errores = 0;
    let totalProcesados = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore && totalProcesados < limiteGlobal) {
      const batchLimit = Math.min(BATCH_SIZE, limiteGlobal - totalProcesados);

      // Obtener lote de comprobantes pendientes
      const resultado = await this.listarComprobantes({
        estados,
        limit: batchLimit,
        offset,
      });

      // El WHERE ya filtra por estados en la query SQL, no necesitamos .filter() redundante
      const comprobantes = resultado.data;

      if (comprobantes.length === 0) {
        hasMore = false;
        break;
      }

      if (comprobantes.length < batchLimit) {
        hasMore = false;
      }

      // Rate limiting configurable para evitar baneos de IP del SRI
      const delayMs = this.configService.get<number>('SRI_REQUEST_DELAY_MS', 150);
      let syncProcessed = 0;

      for (const comp of comprobantes) {
        try {
          const estadoAnterior = comp.estado;

          this.logger.log(
            `Consultando SRI para: ...${comp.claveAcceso.slice(-8)}`,
          );
          const respuestaSri = await this.sriSoapClient.autorizarComprobante(
            comp.claveAcceso,
          );

          let estadoSri = 'NO EXISTE';
          let accion = 'SIN_CAMBIOS';

          if (
            respuestaSri.autorizaciones &&
            respuestaSri.autorizaciones.autorizacion
          ) {
            const auth = Array.isArray(respuestaSri.autorizaciones.autorizacion)
              ? respuestaSri.autorizaciones.autorizacion[0]
              : respuestaSri.autorizaciones.autorizacion;

            estadoSri = auth.estado || 'DESCONOCIDO';

            if (auth.estado === 'AUTORIZADO') {
              await this.repository.updateComprobante(comp.id as string, {
                estado: 'AUTORIZADO',
                estado_sri: 'AUTORIZADO',
                fecha_autorizacion: auth.fechaAutorizacion,
                numero_autorizacion: auth.numeroAutorizacion,
              });

              if (auth.comprobante) {
                const fecha = new Date(comp.fechaEmision);
                const ruc = extractRucFromClaveAcceso(comp.claveAcceso);
                const autorizadoPath = this.xmlStorage.saveXml(
                  ruc,
                  comp.claveAcceso,
                  fecha,
                  'autorizado',
                  auth.comprobante,
                );
                await this.repository.saveXml({
                  comprobante_id: comp.id as string,
                  xml_autorizado_path: autorizadoPath,
                });
              }

              accion = 'ACTUALIZADO';
              actualizados++;
              this.logger.log(
                `...${comp.claveAcceso.slice(-8)}: Actualizado a AUTORIZADO desde SRI`,
              );

              this.eventEmitter.emit('comprobante.autorizado', {
                emisorId: comp.emisorId,
                claveAcceso: comp.claveAcceso,
                tipoComprobante: comp.tipoComprobante,
                secuencial: comp.secuencial,
                fechaAutorizacion: auth.fechaAutorizacion,
                numeroAutorizacion: auth.numeroAutorizacion,
              });
            } else if (
              (auth.estado as string) === 'RECHAZADO' ||
              (auth.estado as string) === 'DEVUELTA' ||
              (auth.estado as string) === 'NO AUTORIZADO'
            ) {
              await this.repository.updateComprobante(comp.id as string, {
                estado: auth.estado as string,
                estado_sri: auth.estado as string,
              });

              accion = 'ACTUALIZADO';
              actualizados++;
              this.logger.log(
                `...${comp.claveAcceso.slice(-8)}: Actualizado a ${auth.estado} desde SRI`,
              );

              this.eventEmitter.emit('comprobante.rechazado', {
                emisorId: comp.emisorId,
                claveAcceso: comp.claveAcceso,
                tipoComprobante: comp.tipoComprobante,
                estado: auth.estado as string,
                mensajes: auth.mensajes?.mensaje || [],
              });
            }
          } else {
            if (reintentar) {
              try {
                await this.reintentarComprobante(comp.claveAcceso);
                accion = 'REINTENTADO';
                reintentados++;
                this.logger.log(
                  `...${comp.claveAcceso.slice(-8)}: Reenviado al SRI`,
                );
              } catch (retryError) {
                accion = 'ERROR_REINTENTO';
                errores++;
                this.logger.error(
                  `...${comp.claveAcceso.slice(-8)}: Error al reintentar - ${(retryError as Error).message}`,
                );
              }
            } else {
              accion = 'PENDIENTE_REINTENTO';
            }
          }

          detalle.push({
            claveAcceso: comp.claveAcceso,
            estadoAnterior,
            estadoSri,
            accion,
          });
        } catch (error) {
          errores++;
          detalle.push({
            claveAcceso: comp.claveAcceso,
            estadoAnterior: comp.estado,
            estadoSri: 'ERROR',
            accion: `ERROR: ${(error as Error).message}`,
          });
          this.logger.error(
            `Error procesando ...${comp.claveAcceso.slice(-8)}: ${(error as Error).message}`,
          );
        } finally {
          // Delay entre llamadas para no saturar el SRI
          syncProcessed++;
          if (syncProcessed % 50 === 0) {
            this.logger.log(
              `Sincronización progreso: ${totalProcesados + syncProcessed}/${limiteGlobal}`,
            );
          }
          if (syncProcessed < comprobantes.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      totalProcesados += comprobantes.length;
      offset += batchLimit;
    }

    this.logger.log(
      `Sincronización completada: ${totalProcesados} procesados, ${actualizados} actualizados, ${reintentados} reintentados, ${errores} errores`,
    );

    return {
      procesados: totalProcesados,
      actualizados,
      reintentados,
      errores,
      detalle,
    };
  }
}
