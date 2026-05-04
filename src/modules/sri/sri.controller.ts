import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SriService } from './sri.service';
import { EmisoresService } from '../emisores/emisores.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { extractRucFromClaveAcceso } from './utils/clave-acceso.utils';
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
import {
  QueryComprobantesDto,
  PaginatedComprobantesDto,
  ComprobanteDetalladoDto,
} from './dto/query-comprobantes.dto';

@ApiTags('SRI - Facturación Electrónica')
@ApiBearerAuth('JWT')
@Controller('sri')
export class SriController {
  private readonly logger = new Logger(SriController.name);

  constructor(
    private readonly sriService: SriService,
    private readonly emisoresService: EmisoresService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Extrae el RUC del emisor desde una clave de acceso (posiciones 10-23)
   * y valida que el usuario actual tenga acceso a ese emisor.
   * Usa utilidad validada en lugar de substring crudo
   */
  private async validateClaveAccesoAccess(
    claveAcceso: string,
    user: JwtPayload,
  ): Promise<void> {
    const rucEmisor = extractRucFromClaveAcceso(claveAcceso);
    await this.emisoresService.validateRucAccess(rucEmisor, user);
  }

  @Post('emitir/factura')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 facturas/min por IP
  @ApiOperation({
    summary: 'Emitir factura electrónica',
    description: 'Genera, firma y envía factura al SRI',
  })
  @ApiBody({ type: CreateFacturaDto })
  @ApiResponse({
    status: 201,
    description: 'Factura encolada para procesamiento asíncrono (según configuración del servidor)',
    type: EmisionEncoladaResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Factura procesada sincronamente (según configuración del servidor)',
    type: FacturaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async emitirFactura(
    @Body() dto: CreateFacturaDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmisionEncoladaResponseDto | FacturaResponseDto> {
    this.logger.log(`POST /sri/emitir/factura`);
    // Validar que el RUC del emisor pertenece al tenant del usuario
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.emitirFactura(dto);
  }

  @Post('emitir/nota-credito')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir nota de crédito electrónica',
    description: 'Genera, firma y envía nota de crédito al SRI',
  })
  @ApiBody({ type: CreateNotaCreditoDto })
  @ApiResponse({
    status: 201,
    description: 'Nota de crédito encolada para procesamiento asíncrono (según configuración)',
    type: EmisionEncoladaResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito procesada sincronamente (según configuración)',
    type: NotaCreditoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async emitirNotaCredito(
    @Body() dto: CreateNotaCreditoDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmisionEncoladaResponseDto | NotaCreditoResponseDto> {
    this.logger.log(`POST /sri/emitir/nota-credito`);
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.emitirNotaCredito(dto);
  }

  @Post('emitir/nota-debito')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir nota de débito electrónica',
    description: 'Genera, firma y envía nota de débito al SRI',
  })
  @ApiBody({ type: CreateNotaDebitoDto })
  @ApiResponse({
    status: 201,
    description: 'Nota de débito encolada para procesamiento asíncrono (según configuración)',
    type: EmisionEncoladaResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Nota de débito procesada sincronamente (según configuración)',
    type: NotaDebitoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async emitirNotaDebito(
    @Body() dto: CreateNotaDebitoDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmisionEncoladaResponseDto | NotaDebitoResponseDto> {
    this.logger.log(`POST /sri/emitir/nota-debito`);
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.emitirNotaDebito(dto);
  }

  @Post('emitir/retencion')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir comprobante de retención electrónico',
    description: 'Genera, firma y envía comprobante de retención al SRI',
  })
  @ApiBody({ type: CreateRetencionDto })
  @ApiResponse({
    status: 201,
    description: 'Retención encolada para procesamiento asíncrono (según configuración)',
    type: EmisionEncoladaResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Retención procesada sincronamente (según configuración)',
    type: RetencionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async emitirRetencion(
    @Body() dto: CreateRetencionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmisionEncoladaResponseDto | RetencionResponseDto> {
    this.logger.log(`POST /sri/emitir/retencion`);
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.emitirRetencion(dto);
  }

  @Post('emitir/guia-remision')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir guía de remisión electrónica',
    description: 'Genera, firma y envía guía de remisión al SRI',
  })
  @ApiBody({ type: CreateGuiaRemisionDto })
  @ApiResponse({
    status: 201,
    description: 'Guía de remisión encolada para procesamiento asíncrono (según configuración)',
    type: EmisionEncoladaResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Guía de remisión procesada sincronamente (según configuración)',
    type: GuiaRemisionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async emitirGuiaRemision(
    @Body() dto: CreateGuiaRemisionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmisionEncoladaResponseDto | GuiaRemisionResponseDto> {
    this.logger.log(`POST /sri/emitir/guia-remision`);
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.emitirGuiaRemision(dto);
  }

  @Get('autorizar/:claveAcceso')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Consultar autorización',
    description: 'Consulta el estado de autorización por clave de acceso',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de autorización',
    type: FacturaResponseDto,
  })
  async consultarAutorizacion(
    @Param('claveAcceso') claveAcceso: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FacturaResponseDto> {
    this.logger.log(`GET /sri/autorizar/${claveAcceso}`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    return this.sriService.consultarAutorizacion(claveAcceso);
  }

  @Post('preview/factura')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vista previa de factura XML',
    description: 'Genera XML sin firmar ni enviar',
  })
  @ApiBody({ type: CreateFacturaDto })
  @ApiResponse({
    status: 200,
    description: 'XML de la factura',
  })
  async previewFactura(
    @Body() dto: CreateFacturaDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ xml: string }> {
    this.logger.log('POST /sri/preview/factura');
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    const xml = this.sriService.generarXmlPreview(dto);
    return { xml };
  }

  @Post('validar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar XML firmado (Upload Archivo)',
    description: 'Valida estructura del XML subiendo el archivo físico (.xml)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo XML firmado a validar',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validarXml(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ valido: boolean; errores: string[] }> {
    this.logger.log('POST /sri/validar (File Upload)');

    if (!file) {
      return {
        valido: false,
        errores: [
          'No se ha adjuntado ningún archivo XML. El campo debe llamarse "file".',
        ],
      };
    }

    const xml = file.buffer.toString('utf-8');
    return this.sriService.validarXml(xml);
  }

  @Post('debug/factura-firmada')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Debug: Generar factura firmada sin enviar',
    description: 'Genera XML firmado para debugging sin enviarlo al SRI',
  })
  @ApiBody({ type: CreateFacturaDto })
  async debugFacturaFirmada(
    @Body() dto: CreateFacturaDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    claveAcceso: string;
    xmlSinFirma: string;
    xmlFirmado: string;
  }> {
    this.logger.log('POST /sri/debug/factura-firmada');
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('Endpoint deshabilitado en producción');
    }
    await this.emisoresService.validateRucAccess(dto.emisor.ruc, user);
    return this.sriService.generarFacturaFirmadaDebug(dto);
  }

  // ==========================================
  // CONSULTA DE COMPROBANTES
  // ==========================================

  @Get('comprobantes')
  @ApiOperation({
    summary: 'Listar comprobantes',
    description:
      'Obtiene lista paginada de comprobantes con filtros opcionales',
  })
  @ApiResponse({ status: 200, description: 'Lista de comprobantes' })
  async listarComprobantes(
    @Query() query: QueryComprobantesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedComprobantesDto> {
    this.logger.log('GET /sri/comprobantes');

    if (user.rol !== UserRole.SUPERADMIN) {
      if (query.rucEmisor) {
        // Validar que el rucEmisor pertenece al tenant del usuario
        await this.emisoresService.validateRucAccess(query.rucEmisor, user);
      } else if (user.tenantId) {
        // Sin rucEmisor explícito: restringir a emisores del tenant
        const emisoresDelTenant = await this.emisoresService.findByTenantId(
          user.tenantId,
        );
        if (!emisoresDelTenant || emisoresDelTenant.length === 0) {
          return {
            data: [],
            meta: {
              total: 0,
              page: 1,
              limit: query.limit || 20,
              totalPages: 0,
            },
          };
        }
        // Pasar IDs de emisores al servicio para filtro directo
        return this.sriService.listarComprobantes({
          ...query,
          emisorIds: emisoresDelTenant.map((e) => e.id),
        });
      }
    }

    return this.sriService.listarComprobantes(query);
  }

  @Get('comprobantes/:claveAcceso')
  @ApiOperation({
    summary: 'Obtener comprobante por clave de acceso',
    description: 'Obtiene detalle completo de un comprobante',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({ status: 200, description: 'Detalle del comprobante' })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async obtenerComprobante(
    @Param('claveAcceso') claveAcceso: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ComprobanteDetalladoDto> {
    this.logger.log(`GET /sri/comprobantes/${claveAcceso}`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    const result = await this.sriService.obtenerComprobante(claveAcceso);
    if (!result) {
      throw new NotFoundException(`Comprobante ${claveAcceso} no encontrado`);
    }
    return result;
  }

  @Get('comprobantes/:claveAcceso/xml')
  @ApiOperation({
    summary: 'Descargar XML autorizado',
    description: 'Descarga el XML autorizado del comprobante',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({ status: 200, description: 'XML autorizado' })
  @ApiResponse({ status: 404, description: 'XML no disponible' })
  async descargarXml(
    @Param('claveAcceso') claveAcceso: string,
    @Res() res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    this.logger.log(`GET /sri/comprobantes/${claveAcceso}/xml`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    const xml = await this.sriService.obtenerXmlAutorizado(claveAcceso);
    if (!xml) {
      throw new NotFoundException(`XML para ${claveAcceso} no disponible`);
    }
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${claveAcceso}.xml"`,
    );
    res.send(xml);
  }

  @Patch('comprobantes/:claveAcceso/anular')
  @ApiOperation({
    summary: 'Anular comprobante',
    description:
      'Marca un comprobante como anulado. Solo aplica para comprobantes que NO han sido autorizados por el SRI',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({ status: 200, description: 'Comprobante anulado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'No se puede anular un comprobante autorizado',
  })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async anularComprobante(
    @Param('claveAcceso') claveAcceso: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; claveAcceso: string; estadoAnterior: string }> {
    this.logger.log(`PATCH /sri/comprobantes/${claveAcceso}/anular`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    return this.sriService.anularComprobante(claveAcceso);
  }

  @Post('comprobantes/:claveAcceso/reintentar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintentar comprobante fallido',
    description:
      'Reenvía al SRI un comprobante con estado DEVUELTA o RECHAZADO para intentar su autorización nuevamente',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({ status: 200, description: 'Comprobante reenviado' })
  @ApiResponse({
    status: 400,
    description: 'El comprobante no puede ser reenviado',
  })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async reintentarComprobante(
    @Param('claveAcceso') claveAcceso: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    claveAcceso: string;
    estado: string;
    fechaAutorizacion?: string;
    mensaje: string;
    errores?: string[];
  }> {
    this.logger.log(`POST /sri/comprobantes/${claveAcceso}/reintentar`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    return this.sriService.reintentarComprobante(claveAcceso);
  }

  @Get('verificar/:claveAcceso')
  @ApiOperation({
    summary: 'Verificar estado en SRI',
    description:
      'Consulta directamente al SRI el estado de autorización de un comprobante. NO modifica la BD local.',
  })
  @ApiParam({
    name: 'claveAcceso',
    description: 'Clave de acceso de 49 dígitos',
  })
  @ApiResponse({ status: 200, description: 'Estado del comprobante en el SRI' })
  @ApiResponse({
    status: 404,
    description: 'Comprobante no encontrado en el SRI',
  })
  async verificarEnSri(
    @Param('claveAcceso') claveAcceso: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    claveAcceso: string;
    existeEnSri: boolean;
    estado: string;
    fechaAutorizacion?: string;
    numeroAutorizacion?: string;
    mensajes?: string[];
    estadoLocal?: string;
    sincronizado: boolean;
  }> {
    this.logger.log(`GET /sri/verificar/${claveAcceso}`);
    await this.validateClaveAccesoAccess(claveAcceso, user);
    return this.sriService.verificarEnSri(claveAcceso);
  }

  @Post('sincronizar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sincronizar comprobantes con SRI',
    description:
      'Consulta el SRI para comprobantes pendientes y actualiza el estado local. ' +
      'Flujo inteligente: primero consulta, si ya está autorizado actualiza BD, si no existe puede reintentar.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estados: {
          type: 'array',
          items: { type: 'string' },
          description: 'Estados a sincronizar',
          example: ['PENDIENTE', 'EN_PROCESO', 'DEVUELTA'],
        },
        reintentar: {
          type: 'boolean',
          description: 'Si true, reenvía los que no existen en SRI',
          default: false,
        },
        limite: {
          type: 'number',
          description: 'Máximo de comprobantes a procesar',
          default: 50,
        },
        rucEmisor: {
          type: 'string',
          description:
            'RUC del emisor a sincronizar (obligatorio para usuarios no-SUPERADMIN)',
          example: '0924383631001',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Resultado de sincronización' })
  async sincronizar(
    @Body()
    body: {
      estados?: string[];
      reintentar?: boolean;
      limite?: number;
      rucEmisor?: string;
    },
    @CurrentUser() user: JwtPayload,
  ): Promise<{
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
    this.logger.log(`POST /sri/sincronizar`);
    if (user.rol !== UserRole.SUPERADMIN) {
      if (!body.rucEmisor) {
        throw new ForbiddenException(
          'Debe especificar rucEmisor para sincronizar',
        );
      }
      await this.emisoresService.validateRucAccess(body.rucEmisor, user);
    }
    return this.sriService.sincronizarConSri(body);
  }
}
