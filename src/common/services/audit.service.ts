import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AuditEntry {
  usuarioId?: string;
  usuarioEmail?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  descripcion?: string;
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  metadata?: Record<string, any>;
  exitoso?: boolean;
  error?: string;
  duracionMs?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Registra un evento de auditoría.
   * Fire-and-forget: nunca debe bloquear el flujo principal.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO auditoria 
         (usuario_id, usuario_email, tenant_id, ip_address, user_agent,
          accion, recurso, recurso_id, descripcion,
          datos_anteriores, datos_nuevos, metadata,
          exitoso, error, duracion_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          entry.usuarioId || null,
          entry.usuarioEmail || null,
          entry.tenantId || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.accion,
          entry.recurso,
          entry.recursoId || null,
          entry.descripcion || null,
          entry.datosAnteriores ? JSON.stringify(entry.datosAnteriores) : null,
          entry.datosNuevos ? JSON.stringify(entry.datosNuevos) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.exitoso ?? true,
          entry.error || null,
          entry.duracionMs ?? null,
        ],
      );
    } catch (error) {
      // Nunca fallar por auditoría — loguear y continuar
      this.logger.error(
        `Error al registrar auditoría [${entry.accion}/${entry.recurso}]: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Buscar registros de auditoría con filtros y paginación
   */
  async search(filters: {
    usuarioId?: string;
    tenantId?: string;
    accion?: string;
    recurso?: string;
    recursoId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.usuarioId) {
      conditions.push(`usuario_id = $${idx++}`);
      params.push(filters.usuarioId);
    }
    if (filters.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(filters.tenantId);
    }
    if (filters.accion) {
      conditions.push(`accion = $${idx++}`);
      params.push(filters.accion);
    }
    if (filters.recurso) {
      conditions.push(`recurso = $${idx++}`);
      params.push(filters.recurso);
    }
    if (filters.recursoId) {
      conditions.push(`recurso_id = $${idx++}`);
      params.push(filters.recursoId);
    }
    if (filters.fechaDesde) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(filters.fechaDesde);
    }
    if (filters.fechaHasta) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(filters.fechaHasta);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM auditoria ${where}`, params),
      this.db.query(
        `SELECT * FROM auditoria ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset],
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: dataResult.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
