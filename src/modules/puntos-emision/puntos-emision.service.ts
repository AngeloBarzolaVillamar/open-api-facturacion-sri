import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TipoComprobante } from '../sri/constants';
import {
  CreatePuntoEmisionDto,
  UpdatePuntoEmisionDto,
  PuntoEmisionResponseDto,
  SecuencialResponseDto,
  UpdateSecuencialDto,
} from './dto';

// Mapeo de códigos a descripciones legibles
const TIPO_COMPROBANTE_LABELS: Record<string, string> = {
  [TipoComprobante.FACTURA]: 'Factura',
  [TipoComprobante.NOTA_CREDITO]: 'Nota de Crédito',
  [TipoComprobante.NOTA_DEBITO]: 'Nota de Débito',
  [TipoComprobante.GUIA_REMISION]: 'Guía de Remisión',
  [TipoComprobante.COMPROBANTE_RETENCION]: 'Comprobante de Retención',
};

@Injectable()
export class PuntosEmisionService {
  private readonly logger = new Logger(PuntosEmisionService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Listar puntos de emisión de un emisor
   */
  async findAll(emisorId: string): Promise<PuntoEmisionResponseDto[]> {
    const result = await this.db.query(
      `SELECT 
        pe.id,
        est.emisor_id,
        pe.establecimiento_id,
        est.codigo as establecimiento,
        pe.codigo as punto_emision,
        est.direccion,
        pe.descripcion,
        pe.estado,
        pe.created_at
       FROM puntos_emision pe
       INNER JOIN establecimientos est ON pe.establecimiento_id = est.id
       WHERE est.emisor_id = $1
       ORDER BY est.codigo, pe.codigo`,
      [emisorId],
    );

    const puntos = await Promise.all(
      result.rows.map(async (row) => {
        const secuenciales = await this.getSecuencialesMap(row.id);
        return this.mapToResponse(row, secuenciales);
      }),
    );

    return puntos;
  }

  /**
   * Obtener un punto de emisión específico
   */
  async findOne(
    emisorId: string,
    puntoEmisionId: string,
  ): Promise<PuntoEmisionResponseDto> {
    const result = await this.db.query(
      `SELECT 
        pe.id,
        est.emisor_id,
        pe.establecimiento_id,
        est.codigo as establecimiento,
        pe.codigo as punto_emision,
        est.direccion,
        pe.descripcion,
        pe.estado,
        pe.created_at
       FROM puntos_emision pe
       INNER JOIN establecimientos est ON pe.establecimiento_id = est.id
       WHERE est.emisor_id = $1 AND pe.id = $2`,
      [emisorId, puntoEmisionId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Punto de emisión no encontrado`);
    }

    const secuenciales = await this.getSecuencialesMap(puntoEmisionId);
    return this.mapToResponse(result.rows[0], secuenciales);
  }

  /**
   * Crear un nuevo punto de emisión
   * Si el establecimiento no existe, lo crea automáticamente
   * Usa transacción para garantizar atomicidad
   */
  async create(
    emisorId: string,
    dto: CreatePuntoEmisionDto,
  ): Promise<PuntoEmisionResponseDto> {
    // Verificar que el emisor existe (fuera de la transacción — solo lectura)
    const emisor = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM emisores WHERE id = $1',
      [emisorId],
    );

    if (!emisor) {
      throw new NotFoundException(`Emisor con ID ${emisorId} no encontrado`);
    }

    // Verificar si ya existe el punto de emisión
    const existing = await this.db.queryOne<{ id: string }>(
      `SELECT pe.id
       FROM puntos_emision pe
       INNER JOIN establecimientos est ON pe.establecimiento_id = est.id
       WHERE est.emisor_id = $1 
       AND est.codigo = $2 
       AND pe.codigo = $3`,
      [emisorId, dto.establecimiento, dto.puntoEmision],
    );

    if (existing) {
      throw new ConflictException(
        `Ya existe un punto de emisión ${dto.establecimiento}-${dto.puntoEmision} para este emisor`,
      );
    }

    // Ejecutar creación dentro de transacción atómica
    const puntoEmisionId = await this.db.transaction(async (client) => {
      // Buscar o crear establecimiento
      let establecimientoId: string;
      const estabResult = await client.query(
        'SELECT id FROM establecimientos WHERE emisor_id = $1 AND codigo = $2',
        [emisorId, dto.establecimiento],
      );

      if (estabResult.rows.length > 0) {
        establecimientoId = estabResult.rows[0].id;

        // Actualizar dirección si se proporcionó
        if (dto.direccionEstablecimiento) {
          await client.query(
            'UPDATE establecimientos SET direccion = $1 WHERE id = $2',
            [dto.direccionEstablecimiento, establecimientoId],
          );
        }
      } else {
        // Crear nuevo establecimiento
        const newEstabResult = await client.query(
          `INSERT INTO establecimientos (emisor_id, codigo, direccion, estado)
           VALUES ($1, $2, $3, 'ACTIVO')
           RETURNING id`,
          [emisorId, dto.establecimiento, dto.direccionEstablecimiento || null],
        );
        establecimientoId = newEstabResult.rows[0].id;
        this.logger.log(
          `Establecimiento ${dto.establecimiento} creado para emisor ${emisorId}`,
        );
      }

      // Crear punto de emisión
      const puntoResult = await client.query(
        `INSERT INTO puntos_emision (establecimiento_id, codigo, descripcion, estado)
         VALUES ($1, $2, $3, 'ACTIVO')
         RETURNING id`,
        [establecimientoId, dto.puntoEmision, dto.descripcion || null],
      );

      const newPuntoId = puntoResult.rows[0].id;

      // Inicializar secuenciales para todos los tipos de comprobante
      const tiposComprobante = [
        TipoComprobante.FACTURA,
        TipoComprobante.NOTA_CREDITO,
        TipoComprobante.NOTA_DEBITO,
        TipoComprobante.GUIA_REMISION,
        TipoComprobante.COMPROBANTE_RETENCION,
      ];
      for (const tipo of tiposComprobante) {
        await client.query(
          `INSERT INTO secuenciales (punto_emision_id, tipo_comprobante, ultimo_secuencial)
           VALUES ($1, $2, 0)`,
          [newPuntoId, tipo],
        );
      }

      return newPuntoId;
    });

    this.logger.log(
      `Punto de emisión ${dto.establecimiento}-${dto.puntoEmision} creado con secuenciales inicializados`,
    );

    return this.findOne(emisorId, puntoEmisionId);
  }

  /**
   * Actualizar un punto de emisión
   */
  async update(
    emisorId: string,
    puntoEmisionId: string,
    dto: UpdatePuntoEmisionDto,
  ): Promise<PuntoEmisionResponseDto> {
    // Verificar que existe y pertenece al emisor
    await this.findOne(emisorId, puntoEmisionId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Actualizar establecimiento si cambió la dirección
    if (dto.direccionEstablecimiento !== undefined) {
      await this.db.query(
        `UPDATE establecimientos est
         SET direccion = $1
         FROM puntos_emision pe
         WHERE pe.id = $2 AND est.id = pe.establecimiento_id`,
        [dto.direccionEstablecimiento, puntoEmisionId],
      );
    }

    // Actualizar punto de emisión
    if (dto.descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      values.push(dto.descripcion);
    }
    if (dto.estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`);
      values.push(dto.estado.toUpperCase());
    }

    if (updates.length > 0) {
      values.push(puntoEmisionId);
      await this.db.query(
        `UPDATE puntos_emision SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        values,
      );
    }

    this.logger.log(`Punto de emisión ${puntoEmisionId} actualizado`);
    return this.findOne(emisorId, puntoEmisionId);
  }

  /**
   * Inactivar un punto de emisión
   */
  async delete(
    emisorId: string,
    puntoEmisionId: string,
  ): Promise<PuntoEmisionResponseDto> {
    const punto = await this.findOne(emisorId, puntoEmisionId);

    if (punto.estado === 'INACTIVO') {
      throw new BadRequestException('El punto de emisión ya está inactivo');
    }

    await this.db.query(
      `UPDATE puntos_emision SET estado = 'INACTIVO'
       WHERE id = $1`,
      [puntoEmisionId],
    );

    this.logger.log(`Punto de emisión ${puntoEmisionId} inactivado`);
    return this.findOne(emisorId, puntoEmisionId);
  }

  /**
   * Obtener todos los secuenciales de un emisor (todos los puntos)
   */
  async getAllSecuencialesByEmisor(
    emisorId: string,
  ): Promise<
    Array<
      SecuencialResponseDto & { establecimiento: string; puntoEmision: string }
    >
  > {
    const result = await this.db.query(
      `SELECT 
        s.id, 
        s.punto_emision_id, 
        s.tipo_comprobante, 
        s.ultimo_secuencial, 
        s.updated_at,
        est.codigo as establecimiento,
        pe.codigo as punto_emision
       FROM secuenciales s
       INNER JOIN puntos_emision pe ON s.punto_emision_id = pe.id
       INNER JOIN establecimientos est ON pe.establecimiento_id = est.id
       WHERE est.emisor_id = $1
       ORDER BY est.codigo, pe.codigo, s.tipo_comprobante`,
      [emisorId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      puntoEmisionId: row.punto_emision_id,
      tipoComprobante: row.tipo_comprobante,
      tipoDescripcion:
        TIPO_COMPROBANTE_LABELS[row.tipo_comprobante] || 'Desconocido',
      ultimoSecuencial: parseInt(row.ultimo_secuencial),
      proximoSecuencial: parseInt(row.ultimo_secuencial) + 1,
      updatedAt: row.updated_at?.toISOString(),
      establecimiento: row.establecimiento,
      puntoEmision: row.punto_emision,
    }));
  }

  /**
   * Obtener secuenciales de un punto de emisión
   */
  async getSecuenciales(
    emisorId: string,
    puntoEmisionId: string,
  ): Promise<SecuencialResponseDto[]> {
    // Verificar que el punto pertenece al emisor
    await this.findOne(emisorId, puntoEmisionId);

    const result = await this.db.query(
      `SELECT id, punto_emision_id, tipo_comprobante, ultimo_secuencial, updated_at
       FROM secuenciales
       WHERE punto_emision_id = $1
       ORDER BY tipo_comprobante`,
      [puntoEmisionId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      puntoEmisionId: row.punto_emision_id,
      tipoComprobante: row.tipo_comprobante,
      tipoDescripcion:
        TIPO_COMPROBANTE_LABELS[row.tipo_comprobante] || 'Desconocido',
      ultimoSecuencial: parseInt(row.ultimo_secuencial),
      proximoSecuencial: parseInt(row.ultimo_secuencial) + 1,
      updatedAt: row.updated_at?.toISOString(),
    }));
  }

  /**
   * Actualizar un secuencial específico
   */
  async updateSecuencial(
    emisorId: string,
    puntoEmisionId: string,
    tipoComprobante: string,
    dto: UpdateSecuencialDto,
  ): Promise<SecuencialResponseDto> {
    // Verificar que el punto pertenece al emisor
    await this.findOne(emisorId, puntoEmisionId);

    // Validar que el tipo de comprobante existe
    if (!TIPO_COMPROBANTE_LABELS[tipoComprobante]) {
      throw new BadRequestException(
        `Tipo de comprobante ${tipoComprobante} no válido`,
      );
    }

    // Validar que el nuevo secuencial no sea negativo
    if (dto.ultimoSecuencial < 0) {
      throw new BadRequestException('El secuencial no puede ser negativo');
    }

    const result = await this.db.query(
      `UPDATE secuenciales
       SET ultimo_secuencial = $1, updated_at = NOW()
       WHERE punto_emision_id = $2 AND tipo_comprobante = $3
       RETURNING id, punto_emision_id, tipo_comprobante, ultimo_secuencial, updated_at`,
      [dto.ultimoSecuencial, puntoEmisionId, tipoComprobante],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `Secuencial ${tipoComprobante} no encontrado para este punto de emisión`,
      );
    }

    const row = result.rows[0];
    this.logger.log(
      `Secuencial ${tipoComprobante} del punto ${puntoEmisionId} actualizado a ${dto.ultimoSecuencial}`,
    );

    return {
      id: row.id,
      puntoEmisionId: row.punto_emision_id,
      tipoComprobante: row.tipo_comprobante,
      tipoDescripcion:
        TIPO_COMPROBANTE_LABELS[row.tipo_comprobante] || 'Desconocido',
      ultimoSecuencial: parseInt(row.ultimo_secuencial),
      proximoSecuencial: parseInt(row.ultimo_secuencial) + 1,
      updatedAt: row.updated_at?.toISOString(),
    };
  }

  // ========== PRIVATE HELPERS ==========

  private async getSecuencialesMap(
    puntoEmisionId: string,
  ): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT tipo_comprobante, ultimo_secuencial
       FROM secuenciales
       WHERE punto_emision_id = $1`,
      [puntoEmisionId],
    );

    const map: Record<string, number> = {};
    for (const row of result.rows) {
      map[row.tipo_comprobante] = parseInt(row.ultimo_secuencial);
    }
    return map;
  }

  private mapToResponse(
    row: any,
    secuenciales?: Record<string, number>,
  ): PuntoEmisionResponseDto {
    return {
      id: row.id,
      emisorId: row.emisor_id,
      establecimientoId: row.establecimiento_id,
      establecimiento: row.establecimiento,
      puntoEmision: row.punto_emision,
      direccion: row.direccion,
      descripcion: row.descripcion,
      estado: row.estado,
      createdAt: row.created_at?.toISOString(),
      secuenciales,
    };
  }
}
