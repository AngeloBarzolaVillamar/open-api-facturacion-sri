import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateTenantDto, UpdateTenantDto, TenantResponseDto } from './dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<TenantResponseDto[]> {
    const result = await this.db.query(
      `SELECT t.id, t.nombre, t.plan, t.estado, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM emisores e WHERE e.tenant_id = t.id) as emisores_count
       FROM tenants t
       ORDER BY t.created_at DESC`,
    );

    return result.rows.map((row) => this.mapToResponse(row));
  }

  async findOne(id: string): Promise<TenantResponseDto> {
    const result = await this.db.query(
      `SELECT t.id, t.nombre, t.plan, t.estado, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM emisores e WHERE e.tenant_id = t.id) as emisores_count
       FROM tenants t
       WHERE t.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }

    return this.mapToResponse(result.rows[0]);
  }

  async create(dto: CreateTenantDto): Promise<TenantResponseDto> {
    const result = await this.db.query(
      `INSERT INTO tenants (nombre, plan, estado)
       VALUES ($1, $2, 'ACTIVO')
       RETURNING id, nombre, plan, estado, created_at, updated_at`,
      [dto.nombre, dto.plan || 'BASICO'],
    );

    this.logger.log(`Tenant creado: ${dto.nombre}`);
    return this.mapToResponse(result.rows[0]);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantResponseDto> {
    await this.findOne(id);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      values.push(dto.nombre);
    }
    if (dto.plan !== undefined) {
      updates.push(`plan = $${paramIndex++}`);
      values.push(dto.plan.toUpperCase());
    }
    if (dto.estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`);
      values.push(dto.estado.toUpperCase());
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE tenants SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id`,
      values,
    );

    this.logger.log(`Tenant actualizado: ${id}`);
    return this.findOne(result.rows[0].id);
  }

  async delete(id: string): Promise<TenantResponseDto> {
    const tenant = await this.findOne(id);

    if (tenant.estado === 'INACTIVO') {
      throw new BadRequestException(`El tenant ya se encuentra inactivo`);
    }

    // Verificar si tiene emisores activos
    if (tenant.emisoresCount && tenant.emisoresCount > 0) {
      this.logger.warn(
        `Tenant ${id} tiene ${tenant.emisoresCount} emisores asociados`,
      );
    }

    await this.db.query(
      `UPDATE tenants SET estado = 'INACTIVO', updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    this.logger.log(`Tenant inactivado: ${id}`);
    return this.findOne(id);
  }

  private mapToResponse(row: any): TenantResponseDto {
    return {
      id: row.id,
      nombre: row.nombre,
      plan: row.plan,
      estado: row.estado,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
      emisoresCount: parseInt(row.emisores_count) || 0,
    };
  }
}
