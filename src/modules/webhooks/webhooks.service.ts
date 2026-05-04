import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookResponseDto,
  WebhookLogResponseDto,
  WebhookEvent,
} from './dto';
import { WebhookJobData } from './webhook.processor';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly db: DatabaseService,
    @InjectQueue('webhook-dispatch') private readonly webhookQueue: Queue,
  ) {}

  // =====================
  // Event Listeners
  // =====================

  @OnEvent('comprobante.autorizado')
  async handleComprobanteAutorizado(payload: any) {
    this.logger.log(
      `Evento comprobante.autorizado recibido para ${payload.claveAcceso}`,
    );
    await this.emit(
      'comprobante.autorizado' as WebhookEvent,
      payload,
      payload.emisorId,
    );
  }

  @OnEvent('comprobante.rechazado')
  async handleComprobanteRechazado(payload: any) {
    this.logger.log(
      `Evento comprobante.rechazado recibido para ${payload.claveAcceso}`,
    );
    await this.emit(
      'comprobante.rechazado' as WebhookEvent,
      payload,
      payload.emisorId,
    );
  }

  // =====================
  // CRUD Operations
  // =====================

  async findAll(emisorId?: string): Promise<WebhookResponseDto[]> {
    let query = `
      SELECT id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, tenant_id, created_at, updated_at
      FROM webhook_configs
    `;
    const params: string[] = [];

    if (emisorId) {
      query += ` WHERE emisor_id = $1`;
      params.push(emisorId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map((row: Record<string, unknown>) => this.mapToResponse(row));
  }

  /**
   * Listado filtrado por tenant — previene fuga de datos multi-tenant
   */
  async findAllByTenant(
    tenantId: string,
    emisorId?: string,
  ): Promise<WebhookResponseDto[]> {
    let query = `
      SELECT id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, tenant_id, created_at, updated_at
      FROM webhook_configs
      WHERE tenant_id = $1
    `;
    const params: string[] = [tenantId];

    if (emisorId) {
      query += ` AND emisor_id = $2`;
      params.push(emisorId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map((row: Record<string, unknown>) => this.mapToResponse(row));
  }

  async findOne(id: string): Promise<WebhookResponseDto> {
    const result = await this.db.query(
      `SELECT id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, created_at, updated_at
       FROM webhook_configs
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Webhook con ID ${id} no encontrado`);
    }

    return this.mapToResponse(result.rows[0]);
  }

  async create(dto: CreateWebhookDto, tenantId?: string): Promise<WebhookResponseDto> {
    const secreto = this.generateSecret();

    const result = await this.db.query(
      `INSERT INTO webhook_configs (nombre, url, eventos, emisor_id, secreto, reintentos_max, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, tenant_id, created_at, updated_at`,
      [
        dto.nombre,
        dto.url,
        dto.eventos,
        dto.emisorId || null,
        secreto,
        dto.reintentosMax || 3,
        tenantId || null,
      ],
    );

    this.logger.log(`Webhook creado: ${dto.nombre} -> ${dto.url}`);
    return this.mapToResponse(result.rows[0]);
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<WebhookResponseDto> {
    await this.findOne(id);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      values.push(dto.nombre);
    }
    if (dto.url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(dto.url);
    }
    if (dto.eventos !== undefined) {
      updates.push(`eventos = $${paramIndex++}`);
      values.push(dto.eventos);
    }
    if (dto.activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      values.push(dto.activo);
    }
    if (dto.reintentosMax !== undefined) {
      updates.push(`reintentos_max = $${paramIndex++}`);
      values.push(dto.reintentosMax);
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE webhook_configs SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, created_at, updated_at`,
      values,
    );

    this.logger.log(`Webhook actualizado: ${id}`);
    return this.mapToResponse(result.rows[0]);
  }

  async delete(id: string): Promise<WebhookResponseDto> {
    const webhook = await this.findOne(id);

    // El recurso existe pero está inactivo — 400, no 404
    if (!webhook.activo) {
      throw new BadRequestException('El webhook ya se encuentra inactivo');
    }

    const result = await this.db.query(
      `UPDATE webhook_configs SET activo = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, created_at, updated_at`,
      [id],
    );

    this.logger.log(`Webhook inactivado: ${id}`);
    return this.mapToResponse(result.rows[0]);
  }

  async regenerateSecret(id: string): Promise<WebhookResponseDto> {
    await this.findOne(id);
    const newSecret = this.generateSecret();

    const result = await this.db.query(
      `UPDATE webhook_configs SET secreto = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, nombre, url, eventos, emisor_id, secreto, activo, reintentos_max, created_at, updated_at`,
      [newSecret, id],
    );

    this.logger.log(`Secreto regenerado para webhook: ${id}`);
    return this.mapToResponse(result.rows[0]);
  }

  // Paginación completa para logs de webhooks
  async getLogs(
    id: string,
    page = 1,
    limit = 50,
  ): Promise<{
    data: WebhookLogResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    await this.findOne(id);

    if (limit > 100) limit = 100; // tope máximo para evitar queries pesados
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) FROM webhook_logs WHERE config_id = $1`,
        [id],
      ),
      this.db.query(
        `SELECT id, evento, payload, status_code, respuesta, intento, exitoso, error, tiempo_respuesta_ms, created_at
         FROM webhook_logs
         WHERE config_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows.map((row: any) => this.mapLogToResponse(row)),
      total,
      page,
      totalPages,
    };
  }

  // =====================
  // Event Dispatching (BullMQ-based)
  // =====================

  /**
   * Despacha webhooks a la cola BullMQ en vez de usar setTimeout.
   * BullMQ gestiona reintentos con backoff exponencial nativo.
   */
  async emit(
    evento: WebhookEvent,
    payload: Record<string, unknown>,
    emisorId?: string,
  ): Promise<void> {
    // Buscar webhooks suscritos a este evento
    let query = `
      SELECT id, url, secreto, reintentos_max
      FROM webhook_configs
      WHERE activo = true AND $1 = ANY(eventos)
    `;
    const params: (string | undefined)[] = [evento];

    if (emisorId) {
      query += ` AND (emisor_id IS NULL OR emisor_id = $2)`;
      params.push(emisorId);
    }

    const configs = await this.db.query(query, params);

    if (configs.rows.length === 0) {
      return; // No hay webhooks suscritos
    }

    this.logger.log(
      `Encolando evento ${evento} a ${configs.rows.length} webhook(s)`,
    );

    // Encolar cada webhook como job de BullMQ
    for (const config of configs.rows) {
      const jobData: WebhookJobData = {
        configId: config.id as string,
        url: config.url as string,
        secreto: config.secreto as string,
        evento,
        payload,
      };

      await this.webhookQueue.add(
        `webhook-${evento}`,
        jobData,
        {
          attempts: (config.reintentos_max as number) || 5,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      );
    }
  }

  // =====================
  // Helpers
  // =====================

  private generateSecret(): string {
    const crypto = require('crypto') as typeof import('crypto');
    return 'whsec_' + crypto.randomBytes(24).toString('hex');
  }

  private mapToResponse(row: Record<string, unknown>): WebhookResponseDto {
    return {
      id: row.id as string,
      nombre: row.nombre as string,
      url: row.url as string,
      eventos: row.eventos as string[],
      emisorId: row.emisor_id as string,
      secreto: row.secreto as string,
      activo: row.activo as boolean,
      reintentosMax: row.reintentos_max as number,
      createdAt: (row.created_at as Date)?.toISOString(),
      updatedAt: (row.updated_at as Date)?.toISOString(),
    };
  }

  private mapLogToResponse(row: Record<string, unknown>): WebhookLogResponseDto {
    return {
      id: row.id as string,
      evento: row.evento as string,
      payload: row.payload,
      statusCode: row.status_code as number,
      respuesta: row.respuesta as string,
      intento: row.intento as number,
      exitoso: row.exitoso as boolean,
      error: row.error as string,
      tiempoRespuestaMs: row.tiempo_respuesta_ms as number,
      createdAt: (row.created_at as Date)?.toISOString(),
    };
  }
}

