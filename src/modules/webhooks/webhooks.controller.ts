import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { EmisoresService } from '../emisores/emisores.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookResponseDto,
  WebhookLogResponseDto,
  WEBHOOK_EVENTS,
} from './dto';

@ApiTags('Webhooks')
@ApiBearerAuth('JWT')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly emisoresService: EmisoresService,
  ) {}

  @Get('eventos')
  @ApiOperation({ summary: 'Listar eventos disponibles para webhooks' })
  @ApiResponse({ status: 200, description: 'Lista de eventos' })
  getEventos(): { eventos: string[]; descripciones: Record<string, string> } {
    return {
      eventos: [...WEBHOOK_EVENTS],
      descripciones: {
        'comprobante.creado': 'Cuando se crea un nuevo comprobante',
        'comprobante.autorizado':
          'Cuando un comprobante es autorizado por el SRI',
        'comprobante.rechazado':
          'Cuando un comprobante es rechazado por el SRI',
        'comprobante.anulado': 'Cuando un comprobante es anulado',
        'comprobante.enviado': 'Cuando un comprobante es enviado al SRI',
        'certificado.por_vencer':
          'Cuando un certificado está por vencer (30 días)',
        'certificado.vencido': 'Cuando un certificado ha vencido',
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar webhooks configurados' })
  @ApiQuery({
    name: 'emisorId',
    required: false,
    description: 'Filtrar por emisor',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de webhooks',
    type: [WebhookResponseDto],
  })
  async findAll(
    @Query('emisorId') emisorId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<WebhookResponseDto[]> {
    // Si se filtra por emisor, validar acceso tenant
    if (emisorId) {
      await this.emisoresService.validateEmisorAccess(emisorId, user);
    }
    // SUPERADMIN ve todos, otros ven solo los de su tenant
    if (user.rol === UserRole.SUPERADMIN) {
      return this.webhooksService.findAll(emisorId);
    }
    return this.webhooksService.findAllByTenant(user.tenantId!, emisorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un webhook por ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook encontrado',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook no encontrado' })
  async findOne(@Param('id') id: string): Promise<WebhookResponseDto> {
    return this.webhooksService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo webhook' })
  @ApiResponse({
    status: 201,
    description: 'Webhook creado',
    type: WebhookResponseDto,
  })
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WebhookResponseDto> {
    // Si se especifica emisorId, validar acceso tenant
    if (dto.emisorId) {
      await this.emisoresService.validateEmisorAccess(dto.emisorId, user);
    }
    // Vincular webhook al tenant del usuario
    return this.webhooksService.create(dto, user.tenantId || undefined);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un webhook' })
  @ApiResponse({
    status: 200,
    description: 'Webhook actualizado',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar un webhook (eliminación lógica)' })
  @ApiResponse({
    status: 200,
    description: 'Webhook inactivado',
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook no encontrado o ya inactivo',
  })
  async delete(@Param('id') id: string): Promise<WebhookResponseDto> {
    return this.webhooksService.delete(id);
  }

  @Post(':id/regenerar-secreto')
  @ApiOperation({ summary: 'Regenerar el secreto de un webhook' })
  @ApiResponse({
    status: 200,
    description: 'Secreto regenerado',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Webhook no encontrado' })
  async regenerateSecret(@Param('id') id: string): Promise<WebhookResponseDto> {
    return this.webhooksService.regenerateSecret(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Obtener logs de ejecución de un webhook' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Número máximo de logs por página (máx. 100)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Logs del webhook paginados',
  })
  @ApiResponse({ status: 404, description: 'Webhook no encontrado' })
  async getLogs(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    data: WebhookLogResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.webhooksService.getLogs(
      id,
      Number(page) || 1,
      Number(limit) || 50,
    );
  }
}
