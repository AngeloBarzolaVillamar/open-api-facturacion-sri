import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateEmisorDto, UpdateEmisorDto, EmisorResponseDto } from './dto';
import * as forge from 'node-forge';
import { EncryptionService } from '../../common/services/encryption.service';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';

@Injectable()
export class EmisoresService {
  private readonly logger = new Logger(EmisoresService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Convierte ambiente legible a código SRI
   * pruebas -> 1, produccion -> 2
   */
  private toAmbienteCodigo(ambiente?: string): string {
    if (!ambiente) return '1'; // Default: pruebas
    if (ambiente === '1' || ambiente === '2') return ambiente;
    return ambiente.toLowerCase() === 'produccion' ? '2' : '1';
  }

  /**
   * Convierte código SRI a texto legible
   */
  private toAmbienteTexto(codigo: string): string {
    return codigo === '2' ? 'produccion' : 'pruebas';
  }

  /**
   * Normaliza estado a mayúsculas
   */
  private toEstadoNormalizado(estado?: string): string {
    if (!estado) return 'ACTIVO';
    return estado.toUpperCase();
  }

  async findAll(): Promise<EmisorResponseDto[]> {
    const result = await this.db.query(
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz,
              obligado_contabilidad, contribuyente_especial, agente_retencion,
              contribuyente_rimpe, ambiente, estado, tenant_id,
              certificado_p12 IS NOT NULL as tiene_certificado,
              certificado_valido_hasta, certificado_sujeto,
              created_at, updated_at
       FROM emisores
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row) => this.mapToResponse(row));
  }

  /**
   * FIX P3: Listar emisores filtrados por tenant — previene data leakage
   */
  async findAllByTenant(tenantId: string): Promise<EmisorResponseDto[]> {
    const result = await this.db.query(
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz,
              obligado_contabilidad, contribuyente_especial, agente_retencion,
              contribuyente_rimpe, ambiente, estado, tenant_id,
              certificado_p12 IS NOT NULL as tiene_certificado,
              certificado_valido_hasta, certificado_sujeto,
              created_at, updated_at
       FROM emisores
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );

    return result.rows.map((row) => this.mapToResponse(row));
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
    if (emisor.tenantId && emisor.tenantId !== user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este emisor');
    }

    return emisor;
  }

  async findOne(id: string): Promise<EmisorResponseDto> {
    const result = await this.db.query(
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz,
              obligado_contabilidad, contribuyente_especial, agente_retencion,
              contribuyente_rimpe, ambiente, estado, tenant_id,
              certificado_p12 IS NOT NULL as tiene_certificado,
              certificado_valido_hasta, certificado_sujeto,
              created_at, updated_at
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
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz,
              obligado_contabilidad, contribuyente_especial, agente_retencion,
              contribuyente_rimpe, ambiente, estado, tenant_id,
              certificado_p12 IS NOT NULL as tiene_certificado,
              certificado_valido_hasta, certificado_sujeto,
              created_at, updated_at
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
      `SELECT id, ruc, razon_social, nombre_comercial, direccion_matriz,
              obligado_contabilidad, contribuyente_especial, agente_retencion,
              contribuyente_rimpe, ambiente, estado, tenant_id,
              certificado_p12 IS NOT NULL as tiene_certificado,
              certificado_valido_hasta, certificado_sujeto,
              created_at, updated_at
       FROM emisores
       WHERE tenant_id = $1 AND estado = 'ACTIVO'`,
      [tenantId],
    );

    return result.rows.map((row: any) => this.mapToResponse(row));
  }

  async create(dto: CreateEmisorDto): Promise<EmisorResponseDto> {
    // Verificar si ya existe
    const existing = await this.findByRuc(dto.ruc);
    if (existing) {
      throw new BadRequestException(`Ya existe un emisor con RUC ${dto.ruc}`);
    }

    const result = await this.db.query(
      `INSERT INTO emisores (
        ruc, razon_social, nombre_comercial, direccion_matriz,
        obligado_contabilidad, contribuyente_especial, agente_retencion,
        contribuyente_rimpe, ambiente, estado, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO', $10)
      RETURNING id, ruc, razon_social, nombre_comercial, direccion_matriz,
                obligado_contabilidad, contribuyente_especial, agente_retencion,
                contribuyente_rimpe, ambiente, estado, tenant_id,
                false as tiene_certificado,
                null as certificado_valido_hasta, null as certificado_sujeto,
                created_at, updated_at`,
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
        dto.tenantId || null,
      ],
    );

    this.logger.log(`Emisor creado: ${dto.ruc} - ${dto.razonSocial}`);
    return this.mapToResponse(result.rows[0]);
  }

  async update(id: string, dto: UpdateEmisorDto): Promise<EmisorResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    const updates: string[] = [];
    const values: any[] = [];
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
       RETURNING id, ruc, razon_social, nombre_comercial, direccion_matriz,
                 obligado_contabilidad, contribuyente_especial, agente_retencion,
                 contribuyente_rimpe, ambiente, estado,
                 certificado_p12 IS NOT NULL as tiene_certificado,
                 certificado_valido_hasta, certificado_sujeto,
                 created_at, updated_at`,
      values,
    );

    this.logger.log(`Emisor actualizado: ${id}`);
    return this.mapToResponse(result.rows[0]);
  }

  async delete(id: string): Promise<EmisorResponseDto> {
    // Verificar que existe
    const emisor = await this.findOne(id);

    // Verificar si ya está inactivo
    if (emisor.estado.toUpperCase() === 'INACTIVO') {
      throw new BadRequestException(`El emisor ya se encuentra inactivo`);
    }

    // Eliminación lógica: cambiar estado a inactivo
    const result = await this.db.query(
      `UPDATE emisores SET 
        estado = 'INACTIVO',
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, ruc, razon_social, nombre_comercial, direccion_matriz,
                 obligado_contabilidad, contribuyente_especial, agente_retencion,
                 contribuyente_rimpe, ambiente, estado,
                 certificado_p12 IS NOT NULL as tiene_certificado,
                 certificado_valido_hasta, certificado_sujeto,
                 created_at, updated_at`,
      [id],
    );

    this.logger.log(`Emisor inactivado: ${id}`);
    return this.mapToResponse(result.rows[0]);
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
    } catch (error) {
      throw new BadRequestException(
        `Error al procesar el certificado: ${error.message}`,
      );
    }

    // Guardar el certificado
    const result = await this.db.query(
      `UPDATE emisores SET
        certificado_p12 = $1,
        certificado_password = $2,
        certificado_valido_hasta = $3,
        certificado_sujeto = $4,
        certificado_updated_at = NOW(),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id, ruc, razon_social, nombre_comercial, direccion_matriz,
                 obligado_contabilidad, contribuyente_especial, agente_retencion,
                 contribuyente_rimpe, ambiente, estado,
                 true as tiene_certificado,
                 certificado_valido_hasta, certificado_sujeto,
                 created_at, updated_at`,
      [
        file,
        await this.encryptionService.encrypt(password),
        certificateInfo.validoHasta,
        certificateInfo.sujeto,
        id,
      ],
    );

    this.logger.log(`Certificado cargado para emisor: ${id}`);
    return this.mapToResponse(result.rows[0]);
  }

  async deleteCertificado(id: string): Promise<EmisorResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    const result = await this.db.query(
      `UPDATE emisores SET
        certificado_p12 = NULL,
        certificado_password = NULL,
        certificado_valido_hasta = NULL,
        certificado_sujeto = NULL,
        certificado_updated_at = NULL,
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, ruc, razon_social, nombre_comercial, direccion_matriz,
                 obligado_contabilidad, contribuyente_especial, agente_retencion,
                 contribuyente_rimpe, ambiente, estado,
                 false as tiene_certificado,
                 null as certificado_valido_hasta, null as certificado_sujeto,
                 created_at, updated_at`,
      [id],
    );

    this.logger.log(`Certificado eliminado para emisor: ${id}`);
    return this.mapToResponse(result.rows[0]);
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

  private mapToResponse(row: any): EmisorResponseDto {
    return {
      id: row.id,
      ruc: row.ruc,
      razonSocial: row.razon_social,
      nombreComercial: row.nombre_comercial,
      direccionMatriz: row.direccion_matriz,
      obligadoContabilidad: row.obligado_contabilidad,
      contribuyenteEspecial: row.contribuyente_especial,
      agenteRetencion: row.agente_retencion,
      contribuyenteRimpe: row.contribuyente_rimpe,
      ambiente: row.ambiente,
      estado: row.estado,
      tenantId: row.tenant_id,
      tieneCertificado: row.tiene_certificado,
      certificadoValidoHasta: row.certificado_valido_hasta?.toISOString(),
      certificadoSujeto: row.certificado_sujeto,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }
}
