import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateEmisorDto,
  UpdateEmisorDto,
  EmisorResponseDto,
  QueryEmisoresDto,
  PaginatedEmisoresResponseDto,
  EmisorEstado,
} from './dto';
import * as forge from 'node-forge';
import { EncryptionService } from '../../common/services/encryption.service';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';

@Injectable()
export class EmisoresService {
  private readonly logger = new Logger(EmisoresService.name);

  // Columnas SELECT extraídas como constante para evitar repetición
  private static readonly EMISOR_COLUMNS = `
    id, ruc, razon_social, nombre_comercial, direccion_matriz,
    obligado_contabilidad, contribuyente_especial, agente_retencion,
    contribuyente_rimpe, ambiente, estado, tenant_id,
    certificado_p12 IS NOT NULL as tiene_certificado,
    certificado_valido_hasta, certificado_sujeto,
    created_at, updated_at
  `;

  constructor(
    private readonly db: DatabaseService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Convierte ambiente legible a código SRI.
   * No tiene fallback silencioso — lanza BadRequestException si el valor es inválido.
   */
  private toAmbienteCodigo(ambiente: string): string {
    const map: Record<string, string> = {
      pruebas:    '1',
      produccion: '2',
      '1': '1',
      '2': '2',
    };
    const code = map[ambiente?.toLowerCase()];
    if (!code) {
      throw new BadRequestException(
        `Ambiente inválido: "${ambiente}". Use: pruebas, produccion, 1 ó 2`,
      );
    }
    return code;
  }

  /**
   * Convierte código SRI a texto legible
   */
  private toAmbienteTexto(codigo: string): string {
    return codigo === '2' ? 'produccion' : 'pruebas';
  }

  /**
   * Normaliza estado a mayúsculas.
   * El valor ya viene validado por @IsEnum(EmisorEstado) en el DTO.
   */
  private toEstadoNormalizado(estado: string): string {
    return estado.toUpperCase();
  }

  async findAll(query: QueryEmisoresDto): Promise<PaginatedEmisoresResponseDto> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    const conditions: string[] = [];
    const params: unknown[] = [];

    // Default to ACTIVO state filter to avoid leakage of inactives by default
    const estado = query.estado ?? EmisorEstado.ACTIVO;
    conditions.push(`estado = $${params.push(estado)}`);

    if (query.tenantId) {
      conditions.push(`tenant_id = $${params.push(query.tenantId)}`);
    }

    if (cursor) {
      conditions.push(`id > $${params.push(cursor)}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query(
      `SELECT ${EmisoresService.EMISOR_COLUMNS}
       FROM emisores
       ${whereClause}
       ORDER BY id ASC
       LIMIT $${params.push(limit + 1)}`,
      params,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? (rows[rows.length - 1].id as string) : null;

    return {
      data: rows.map((row) => this.mapToResponse(row)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * FIX P3: Listar emisores filtrados por tenant — previene data leakage
   */
  async findAllByTenant(tenantId: string, query: QueryEmisoresDto): Promise<PaginatedEmisoresResponseDto> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    const conditions: string[] = [`tenant_id = $1`];
    const params: unknown[] = [tenantId];

    // Default to ACTIVO state filter
    const estado = query.estado ?? EmisorEstado.ACTIVO;
    conditions.push(`estado = $${params.push(estado)}`);

    if (cursor) {
      conditions.push(`id > $${params.push(cursor)}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.db.query(
      `SELECT ${EmisoresService.EMISOR_COLUMNS}
       FROM emisores
       ${whereClause}
       ORDER BY id ASC
       LIMIT $${params.push(limit + 1)}`,
      params,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? (rows[rows.length - 1].id as string) : null;

    return {
      data: rows.map((row) => this.mapToResponse(row)),
      nextCursor,
      hasMore,
    };
  }


  /**
   * FIX P3: Acceso seguro a un emisor — verifica que pertenece al tenant del usuario
   */
  async findOneSecured(
    id: string,
    user: JwtPayload,
  ): Promise<EmisorResponseDto> {
    const emisor = await this.findOne(id);

    // SUPERADMIN puede ver cualquier emisor
    if (user.rol === UserRole.SUPERADMIN) {
      return emisor;
    }

    // Verificar que el emisor pertenece al tenant del usuario
    if (!emisor.tenantId || emisor.tenantId !== user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este emisor');
    }

    return emisor;
  }

  async findOne(id: string): Promise<EmisorResponseDto> {
    const result = await this.db.query(
      `SELECT ${EmisoresService.EMISOR_COLUMNS}
       FROM emisores
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Emisor con ID ${id} no encontrado`);
    }

    return this.mapToResponse(result.rows[0]);
  }

  /**
   * Valida que un emisorId pertenece al tenant del usuario.
   * SUPERADMIN tiene acceso a todos. Lanza ForbiddenException si no tiene acceso.
   * Retorna el emisor validado.
   */
  async validateEmisorAccess(
    emisorId: string,
    user: JwtPayload,
  ): Promise<EmisorResponseDto> {
    const emisor = await this.findOne(emisorId);

    if (user.rol === UserRole.SUPERADMIN) {
      return emisor;
    }

    if (
      !user.tenantId ||
      (emisor.tenantId && emisor.tenantId !== user.tenantId)
    ) {
      this.logger.warn(
        `IDOR blocked: user ${user.sub} (tenant ${user.tenantId}) tried to access emisor ${emisorId} (tenant ${emisor.tenantId})`,
      );
      throw new ForbiddenException('No tienes acceso a este emisor');
    }

    return emisor;
  }

  /**
   * Valida que un RUC pertenece a un emisor del tenant del usuario.
   * SUPERADMIN tiene acceso a todos. Lanza ForbiddenException si no tiene acceso.
   * Retorna el emisor validado.
   */
  async validateRucAccess(
    ruc: string,
    user: JwtPayload,
  ): Promise<EmisorResponseDto> {
    const emisor = await this.findByRuc(ruc);

    if (!emisor) {
      throw new NotFoundException(`Emisor con RUC ${ruc} no encontrado`);
    }

    if (user.rol === UserRole.SUPERADMIN) {
      return emisor;
    }

    if (
      !user.tenantId ||
      (emisor.tenantId && emisor.tenantId !== user.tenantId)
    ) {
      this.logger.warn(
        `IDOR blocked: user ${user.sub} (tenant ${user.tenantId}) tried to access RUC ${ruc} (tenant ${emisor.tenantId})`,
      );
      throw new ForbiddenException('No tienes acceso a este emisor');
    }

    return emisor;
  }

  async findByRuc(ruc: string): Promise<EmisorResponseDto | null> {
    const result = await this.db.query(
      `SELECT ${EmisoresService.EMISOR_COLUMNS}
       FROM emisores
       WHERE ruc = $1`,
      [ruc],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToResponse(result.rows[0]);
  }

  /**
   * Obtiene todos los emisores que pertenecen a un tenant específico.
   * Retorna solo emisores activos.
   */
  async findByTenantId(tenantId: string): Promise<EmisorResponseDto[]> {
    const result = await this.db.query(
      `SELECT ${EmisoresService.EMISOR_COLUMNS}
       FROM emisores
       WHERE tenant_id = $1 AND estado = 'ACTIVO'`,
      [tenantId],
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapToResponse(row));
  }

  async create(dto: CreateEmisorDto): Promise<EmisorResponseDto> {
    // Verificar si ya existe
    const existing = await this.findByRuc(dto.ruc);
    if (existing) {
      throw new BadRequestException(`Ya existe un emisor con RUC ${dto.ruc}`);
    }

    // Si no se especifica ambiente, lanza error explícito
    if (!dto.ambiente) {
      throw new BadRequestException(
        'El campo ambiente es requerido. Use: pruebas, produccion, 1 ó 2',
      );
    }

    const result = await this.db.query(
      `INSERT INTO emisores (
        ruc, razon_social, nombre_comercial, direccion_matriz,
        obligado_contabilidad, contribuyente_especial, agente_retencion,
        contribuyente_rimpe, ambiente, estado, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        dto.ruc,
        dto.razonSocial,
        dto.nombreComercial || null,
        dto.direccionMatriz,
        dto.obligadoContabilidad ?? false,
        dto.contribuyenteEspecial || null,
        dto.agenteRetencion || null,
        dto.contribuyenteRimpe ?? false,
        this.toAmbienteCodigo(dto.ambiente),
        EmisorEstado.ACTIVO,
        dto.tenantId || null,
      ],
    );

    this.logger.log(`Emisor creado: ${dto.ruc} - ${dto.razonSocial}`);
    return this.findOne(result.rows[0].id);
  }

  async update(id: string, dto: UpdateEmisorDto): Promise<EmisorResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.razonSocial !== undefined) {
      updates.push(`razon_social = $${paramIndex++}`);
      values.push(dto.razonSocial);
    }
    if (dto.nombreComercial !== undefined) {
      updates.push(`nombre_comercial = $${paramIndex++}`);
      values.push(dto.nombreComercial);
    }
    if (dto.direccionMatriz !== undefined) {
      updates.push(`direccion_matriz = $${paramIndex++}`);
      values.push(dto.direccionMatriz);
    }
    if (dto.obligadoContabilidad !== undefined) {
      updates.push(`obligado_contabilidad = $${paramIndex++}`);
      values.push(dto.obligadoContabilidad);
    }
    if (dto.contribuyenteEspecial !== undefined) {
      updates.push(`contribuyente_especial = $${paramIndex++}`);
      values.push(dto.contribuyenteEspecial);
    }
    if (dto.agenteRetencion !== undefined) {
      updates.push(`agente_retencion = $${paramIndex++}`);
      values.push(dto.agenteRetencion);
    }
    if (dto.contribuyenteRimpe !== undefined) {
      updates.push(`contribuyente_rimpe = $${paramIndex++}`);
      values.push(dto.contribuyenteRimpe);
    }
    if (dto.ambiente !== undefined) {
      updates.push(`ambiente = $${paramIndex++}`);
      values.push(this.toAmbienteCodigo(dto.ambiente));
    }
    if (dto.estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`);
      // El estado ya viene validado por @IsEnum en el DTO
      values.push(this.toEstadoNormalizado(dto.estado));
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE emisores SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id`,
      values,
    );

    this.logger.log(`Emisor actualizado: ${id}`);
    return this.findOne(id);
  }

  async delete(id: string): Promise<EmisorResponseDto> {
    // Verificar que existe
    const emisor = await this.findOne(id);

    // Verificar si ya está inactivo
    if (emisor.estado.toUpperCase() === 'INACTIVO') {
      throw new BadRequestException(`El emisor ya se encuentra inactivo`);
    }

    // Eliminación lógica: cambiar estado a inactivo
    await this.db.query(
      `UPDATE emisores SET
        estado = 'INACTIVO',
        updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    this.logger.log(`Emisor inactivado: ${id}`);
    return this.findOne(id);
  }

  async uploadCertificado(
    id: string,
    file: Buffer,
    password: string,
  ): Promise<EmisorResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    // Validar el certificado P12
    let certificateInfo: { validoHasta: Date; sujeto: string };
    try {
      certificateInfo = this.extractCertificateInfo(file, password);
    } catch (error: unknown) {
      // Tipado correcto de error en catch
      const msg = error instanceof Error ? error.message : 'Error desconocido al procesar el certificado';
      throw new BadRequestException(`Error al procesar el certificado: ${msg}`);
    }

    // Guardar el certificado
    await this.db.query(
      `UPDATE emisores SET
        certificado_p12 = $1,
        certificado_password_encrypted = $2,
        certificado_password = NULL,
        certificado_valido_hasta = $3,
        certificado_sujeto = $4,
        certificado_updated_at = NOW(),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id`,
      [
        file,
        await this.encryptionService.encrypt(password),
        certificateInfo.validoHasta,
        certificateInfo.sujeto,
        id,
      ],
    );

    this.logger.log(`Certificado cargado para emisor: ${id}`);
    return this.findOne(id);
  }

  async deleteCertificado(id: string): Promise<EmisorResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    await this.db.query(
      `UPDATE emisores SET
        certificado_p12 = NULL,
        certificado_password = NULL,
        certificado_password_encrypted = NULL,
        certificado_valido_hasta = NULL,
        certificado_sujeto = NULL,
        certificado_updated_at = NULL,
        updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    this.logger.log(`Certificado eliminado para emisor: ${id}`);
    return this.findOne(id);
  }

  private extractCertificateInfo(
    p12Buffer: Buffer,
    password: string,
  ): { validoHasta: Date; sujeto: string } {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];

    if (!certBag || certBag.length === 0) {
      throw new Error('No se encontró certificado en el archivo P12');
    }

    const cert = certBag[0].cert;
    if (!cert) {
      throw new Error('Certificado inválido');
    }

    const validoHasta = cert.validity.notAfter;
    const sujeto = cert.subject.attributes
      .map((attr) => `${String(attr.shortName)}=${String(attr.value)}`)
      .join(', ');

    return { validoHasta, sujeto };
  }

  private mapToResponse(row: Record<string, unknown>): EmisorResponseDto {
    return {
      id: row.id as string,
      ruc: row.ruc as string,
      razonSocial: row.razon_social as string,
      nombreComercial: row.nombre_comercial as string | undefined,
      direccionMatriz: row.direccion_matriz as string,
      obligadoContabilidad: row.obligado_contabilidad as boolean,
      contribuyenteEspecial: row.contribuyente_especial as string | undefined,
      agenteRetencion: row.agente_retencion as string | undefined,
      contribuyenteRimpe: row.contribuyente_rimpe as boolean,
      ambiente: row.ambiente as string,
      estado: row.estado as string,
      tenantId: row.tenant_id as string | undefined,
      tieneCertificado: row.tiene_certificado as boolean,
      certificadoValidoHasta: (row.certificado_valido_hasta as Date)?.toISOString(),
      certificadoSujeto: row.certificado_sujeto as string | undefined,
      createdAt: (row.created_at as Date)?.toISOString(),
      updatedAt: (row.updated_at as Date)?.toISOString(),
    };
  }
}
