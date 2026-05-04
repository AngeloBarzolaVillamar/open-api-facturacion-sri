import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../../database';
import {
  ComprobanteRecord,
  DetalleRecord,
  ImpuestoRecord,
  TotalRecord,
  PagoRecord,
  RetencionRecord,
  ImpuestoDocSustentoRecord,
  XmlRecord,
  InfoAdicionalRecord,
  DetalleAdicionalRecord,
  DestinatarioGuiaRecord,
  DetalleGuiaRecord,
  MotivoNotaDebitoRecord,
  EmisorRecord,
} from '../interfaces/repository.interface';

@Injectable()
export class SriRepositoryService {
  private readonly logger = new Logger(SriRepositoryService.name);

  // ==========================================
  // CACHE DE EMISOR (TTL: 5 minutos)
  // ==========================================
  private emisorCache: Map<string, { data: EmisorRecord; expiry: number }> =
    new Map();
  private puntoEmisionCache: Map<string, { data: any; expiry: number }> =
    new Map();
  private readonly CACHE_TTL_MS: number;

  // Whitelist de tablas permitidas para bulkInsert
  private static readonly ALLOWED_TABLES = new Set([
    'comprobantes',
    'comprobante_detalles',
    'comprobante_impuestos',
    'comprobante_totales',
    'comprobante_pagos',
    'comprobante_retenciones',
    'impuestos_doc_sustento',
    'comprobante_xmls',
    'info_adicional',
    'detalles_adicionales',
    'destinatarios_guia',
    'detalles_guia',
    'motivos_nota_debito',
  ]);

  // Regex para validar identificadores SQL
  private static readonly SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  /**
   * Helper: Bulk INSERT multi-row to reduce N+1 queries to 1 query.
   * Computes the union of all defined keys across all records to handle
   * optional fields that may only appear in some records.
   * Identifiers sanitized against SQL injection.
   */
  private async bulkInsert<T extends Record<string, any>>(
    table: string,
    records: T[],
    client?: PoolClient,
  ): Promise<T[]> {
    if (records.length === 0) return [];

    // Validar tabla contra whitelist
    if (!SriRepositoryService.ALLOWED_TABLES.has(table)) {
      throw new Error(
        `Tabla no permitida para bulkInsert: "${table}". Solo se permiten tablas del catálogo SRI.`,
      );
    }

    const queryFn = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);

    // Union of all defined keys across all records
    const allKeys = new Set<string>();
    for (const rec of records) {
      for (const k of Object.keys(rec)) {
        if (rec[k] !== undefined) allKeys.add(k);
      }
    }
    const keys = Array.from(allKeys);

    // Validar cada columna contra el regex
    for (const k of keys) {
      if (!SriRepositoryService.SAFE_IDENTIFIER.test(k)) {
        throw new Error(
          `Nombre de columna no válido: "${k}". Solo se permiten letras, números y guión bajo.`,
        );
      }
    }

    const columns = keys.join(', ');

    const MAX_PG_PARAMS = 65535;
    const MAX_ROWS = Math.max(1, Math.floor(MAX_PG_PARAMS / keys.length));
    const allResults: T[] = [];

    for (let i = 0; i < records.length; i += MAX_ROWS) {
      const batch = records.slice(i, i + MAX_ROWS);
      const values: any[] = [];
      const rowPlaceholders: string[] = [];

      for (let j = 0; j < batch.length; j++) {
        const rowValues = keys.map((k) => batch[j][k] ?? null);
        const base = j * keys.length;
        const placeholders = keys
          .map((_, kIndex) => `$${base + kIndex + 1}`)
          .join(', ');
        rowPlaceholders.push(`(${placeholders})`);
        values.push(...rowValues);
      }

      const result = await queryFn(
        `INSERT INTO ${table} (${columns}) VALUES ${rowPlaceholders.join(', ')} RETURNING *`,
        values,
      );
      allResults.push(...result.rows);
    }

    return allResults;
  }

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.CACHE_TTL_MS = this.configService.get<number>(
      'CACHE_EMISOR_TTL_MS',
      300000,
    ); // 5 min default
  }

  // ==========================================
  // EMISOR METHODS
  // ==========================================

  async findEmisorByRuc(ruc: string): Promise<EmisorRecord | null> {
    // Check cache first
    const cached = this.emisorCache.get(ruc);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Query database
    const emisor = await this.db.queryOne<EmisorRecord>(
      'SELECT * FROM emisores WHERE ruc = $1 AND estado = $2',
      [ruc, 'ACTIVO'],
    );

    // Store in cache if found
    if (emisor) {
      this.emisorCache.set(ruc, {
        data: emisor,
        expiry: Date.now() + this.CACHE_TTL_MS,
      });
    }

    return emisor;
  }

  async findPuntoEmision(
    emisorId: string,
    establecimiento: string,
    puntoEmision: string,
  ): Promise<{ punto_emision_id: string; establecimiento_id: string } | null> {
    // Check cache first
    const cacheKey = `${emisorId}-${establecimiento}-${puntoEmision}`;
    const cached = this.puntoEmisionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Query database
    const result = await this.db.queryOne<any>(
      `SELECT pe.id as punto_emision_id, e.id as establecimiento_id
       FROM puntos_emision pe
       JOIN establecimientos e ON pe.establecimiento_id = e.id
       WHERE e.emisor_id = $1 AND e.codigo = $2 AND pe.codigo = $3
       AND e.estado = 'ACTIVO' AND pe.estado = 'ACTIVO'`,
      [emisorId, establecimiento, puntoEmision],
    );

    // Store in cache if found
    if (result) {
      this.puntoEmisionCache.set(cacheKey, {
        data: result,
        expiry: Date.now() + this.CACHE_TTL_MS,
      });
    }

    return result;
  }

  // ==========================================
  // SECUENCIAL METHODS
  // ==========================================

  async getNextSecuencial(
    puntoEmisionId: string,
    tipoComprobante: string,
    client?: PoolClient,
  ): Promise<string> {
    const queryFn = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);

    // Atomic upsert: INSERT or UPDATE in a single query to prevent race conditions
    const result = await queryFn(
      `INSERT INTO secuenciales (punto_emision_id, tipo_comprobante, ultimo_secuencial)
       VALUES ($1, $2, 1)
       ON CONFLICT (punto_emision_id, tipo_comprobante) 
       DO UPDATE SET ultimo_secuencial = secuenciales.ultimo_secuencial + 1, updated_at = NOW()
       RETURNING ultimo_secuencial`,
      [puntoEmisionId, tipoComprobante],
    );

    return String(result.rows[0].ultimo_secuencial).padStart(9, '0');
  }

  // ==========================================
  // COMPROBANTE METHODS
  // ==========================================

  async createComprobante(
    data: ComprobanteRecord,
    client?: PoolClient,
  ): Promise<ComprobanteRecord> {
    const queryFn = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);

    const keys = Object.keys(data).filter((k) => data[k] !== undefined);

    // Validar columnas
    for (const k of keys) {
      if (!SriRepositoryService.SAFE_IDENTIFIER.test(k)) {
        throw new Error(`Nombre de columna no válido: "${k}"`);
      }
    }

    const values = keys.map((k) => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const result = await queryFn(
      `INSERT INTO comprobantes (${columns}) VALUES (${placeholders}) RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async updateComprobante(
    id: string,
    data: Partial<ComprobanteRecord>,
    client?: PoolClient,
  ): Promise<ComprobanteRecord> {
    const queryFn = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);

    const keys = Object.keys(data).filter((k) => data[k] !== undefined);

    // Validar columnas
    for (const k of keys) {
      if (!SriRepositoryService.SAFE_IDENTIFIER.test(k)) {
        throw new Error(`Nombre de columna no válido: "${k}"`);
      }
    }

    const values = keys.map((k) => data[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const result = await queryFn(
      `UPDATE comprobantes SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id],
    );

    return result.rows[0];
  }

  async findComprobanteByClaveAcceso(
    claveAcceso: string,
  ): Promise<ComprobanteRecord | null> {
    return this.db.queryOne<ComprobanteRecord>(
      'SELECT * FROM comprobantes WHERE clave_acceso = $1',
      [claveAcceso],
    );
  }

  // ==========================================
  // DETALLES METHODS
  // ==========================================

  async createDetalles(
    detalles: DetalleRecord[],
    client?: PoolClient,
  ): Promise<DetalleRecord[]> {
    return this.bulkInsert('comprobante_detalles', detalles, client);
  }

  // ==========================================
  // IMPUESTOS METHODS
  // ==========================================

  async createImpuestos(
    impuestos: ImpuestoRecord[],
    client?: PoolClient,
  ): Promise<ImpuestoRecord[]> {
    return this.bulkInsert('comprobante_impuestos', impuestos, client);
  }

  // ==========================================
  // TOTALES METHODS
  // ==========================================

  async createTotales(
    totales: TotalRecord[],
    client?: PoolClient,
  ): Promise<TotalRecord[]> {
    return this.bulkInsert('comprobante_totales', totales, client);
  }

  // ==========================================
  // PAGOS METHODS
  // ==========================================

  async createPagos(
    pagos: PagoRecord[],
    client?: PoolClient,
  ): Promise<PagoRecord[]> {
    return this.bulkInsert('comprobante_pagos', pagos, client);
  }

  // ==========================================
  // RETENCIONES METHODS
  // ==========================================

  async createRetenciones(
    retenciones: RetencionRecord[],
    client?: PoolClient,
  ): Promise<RetencionRecord[]> {
    return this.bulkInsert('comprobante_retenciones', retenciones, client);
  }

  async createImpuestosDocSustento(
    impuestos: ImpuestoDocSustentoRecord[],
    client?: PoolClient,
  ): Promise<ImpuestoDocSustentoRecord[]> {
    return this.bulkInsert('impuestos_doc_sustento', impuestos, client);
  }

  // ==========================================
  // XML METHODS
  // ==========================================

  async saveXml(data: XmlRecord, client?: PoolClient): Promise<XmlRecord> {
    const queryFn = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);

    const result = await queryFn(
      `INSERT INTO comprobante_xmls (comprobante_id, xml_firmado_path, xml_autorizado_path)
       VALUES ($1, $2, $3)
       ON CONFLICT (comprobante_id) DO UPDATE SET
         xml_firmado_path = COALESCE($2, comprobante_xmls.xml_firmado_path),
         xml_autorizado_path = COALESCE($3, comprobante_xmls.xml_autorizado_path)
       RETURNING *`,
      [data.comprobante_id, data.xml_firmado_path, data.xml_autorizado_path],
    );
    return result.rows[0];
  }

  // ==========================================
  // INFO ADICIONAL METHODS
  // ==========================================

  async createInfoAdicional(
    items: InfoAdicionalRecord[],
    client?: PoolClient,
  ): Promise<InfoAdicionalRecord[]> {
    return this.bulkInsert('info_adicional', items, client);
  }

  async createDetallesAdicionales(
    items: DetalleAdicionalRecord[],
    client?: PoolClient,
  ): Promise<DetalleAdicionalRecord[]> {
    return this.bulkInsert('detalles_adicionales', items, client);
  }

  // ==========================================
  // GUIA REMISION METHODS
  // ==========================================

  async createDestinatariosGuia(
    destinatarios: DestinatarioGuiaRecord[],
    client?: PoolClient,
  ): Promise<DestinatarioGuiaRecord[]> {
    return this.bulkInsert('destinatarios_guia', destinatarios, client);
  }

  async createDetallesGuia(
    detalles: DetalleGuiaRecord[],
    client?: PoolClient,
  ): Promise<DetalleGuiaRecord[]> {
    return this.bulkInsert('detalles_guia', detalles, client);
  }

  // ==========================================
  // NOTA DEBITO METHODS
  // ==========================================

  async createMotivosNotaDebito(
    motivos: MotivoNotaDebitoRecord[],
    client?: PoolClient,
  ): Promise<MotivoNotaDebitoRecord[]> {
    return this.bulkInsert('motivos_nota_debito', motivos, client);
  }

  // ==========================================
  // TRANSACTION HELPER
  // ==========================================

  async executeInTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Busca comprobantes con filtros y paginación
   */
  async findComprobantes(filters: {
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
    page: number;
    limit: number;
  }): Promise<{ data: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.emisorIds && filters.emisorIds.length > 0) {
      conditions.push(`c.emisor_id = ANY($${paramIndex++})`);
      params.push(filters.emisorIds);
    } else if (filters.rucEmisor) {
      conditions.push(`e.ruc = $${paramIndex++}`);
      params.push(filters.rucEmisor);
    }

    if (filters.identificacionComprador) {
      conditions.push(`c.identificacion_comprador = $${paramIndex++}`);
      params.push(filters.identificacionComprador);
    }

    if (filters.tipoComprobante) {
      conditions.push(`c.tipo_comprobante = $${paramIndex++}`);
      params.push(filters.tipoComprobante);
    }

    if (filters.estados && filters.estados.length > 0) {
      conditions.push(`c.estado = ANY($${paramIndex++})`);
      params.push(filters.estados);
    } else if (filters.estado) {
      conditions.push(`c.estado = $${paramIndex++}`);
      params.push(filters.estado);
    }

    if (filters.fechaDesde) {
      conditions.push(`c.fecha_emision >= $${paramIndex++}`);
      params.push(filters.fechaDesde);
    }

    if (filters.fechaHasta) {
      conditions.push(`c.fecha_emision <= $${paramIndex++}`);
      params.push(filters.fechaHasta);
    }

    if (filters.establecimiento) {
      conditions.push(`c.establecimiento = $${paramIndex++}`);
      params.push(filters.establecimiento);
    }

    if (filters.puntoEmision) {
      conditions.push(`c.punto_emision = $${paramIndex++}`);
      params.push(filters.puntoEmision);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    // Get data with pagination and total count in a single query
    const dataResult = await this.db.query<any>(
      `SELECT 
        c.id,
        c.emisor_id,
        c.clave_acceso,
        c.tipo_comprobante,
        c.ambiente,
        c.fecha_emision,
        c.secuencial,
        c.estado,
        c.fecha_autorizacion,
        c.numero_autorizacion as num_autorizacion,
        c.total_sin_impuestos as subtotal,
        c.importe_total as total,
        c.receptor_identificacion as identificacion_comprador,
        c.receptor_razon_social as razon_social_comprador,
        e.ruc as ruc_emisor,
        e.razon_social as razon_social_emisor,
        est.codigo as establecimiento,
        pe.codigo as punto_emision,
        c.created_at,
        c.updated_at,
        COUNT(*) OVER() AS full_count
      FROM comprobantes c
      LEFT JOIN emisores e ON c.emisor_id = e.id
      LEFT JOIN puntos_emision pe ON c.punto_emision_id = pe.id
      LEFT JOIN establecimientos est ON pe.establecimiento_id = est.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, filters.limit, offset],
    );

    const total =
      dataResult.rows.length > 0
        ? parseInt(dataResult.rows[0].full_count, 10)
        : 0;
    return { data: dataResult.rows, total };
  }

  /**
   * Busca un comprobante por clave de acceso con info de XML disponible
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findComprobanteConDetalles(claveAcceso: string): Promise<any> {
    return this.db.queryOne<any>(
      `SELECT 
        c.*,
        e.ruc as ruc_emisor,
        e.razon_social as razon_social_emisor,
        est.codigo as establecimiento,
        pe.codigo as punto_emision,
        c.total_sin_impuestos as subtotal,
        c.importe_total as total,
        c.receptor_identificacion as identificacion_comprador,
        c.receptor_razon_social as razon_social_comprador,
        c.numero_autorizacion as num_autorizacion,
        CASE 
          WHEN x.id IS NOT NULL THEN true 
          ELSE false 
        END as xml_disponible
      FROM comprobantes c
      LEFT JOIN comprobante_xmls x ON c.id = x.comprobante_id
      LEFT JOIN emisores e ON c.emisor_id = e.id
      LEFT JOIN puntos_emision pe ON c.punto_emision_id = pe.id
      LEFT JOIN establecimientos est ON pe.establecimiento_id = est.id
      WHERE c.clave_acceso = $1`,
      [claveAcceso],
    );
  }

  /**
   * Obtiene los detalles de un comprobante
   */
  async findDetallesByComprobanteId(comprobanteId: string): Promise<any[]> {
    const result = await this.db.query<any>(
      `SELECT 
        d.id,
        d.codigo_principal,
        d.codigo_auxiliar,
        d.descripcion,
        d.cantidad,
        d.precio_unitario,
        d.descuento,
        d.precio_total_sin_impuesto as subtotal
      FROM comprobante_detalles d
      WHERE d.comprobante_id = $1
      ORDER BY d.id`,
      [comprobanteId],
    );
    return result.rows;
  }

  /**
   * Obtiene la info adicional de un comprobante
   * Retorna array vacío si la tabla no existe o no hay datos
   */
  async findInfoAdicionalByComprobanteId(
    comprobanteId: string,
  ): Promise<any[]> {
    try {
      const result = await this.db.query<any>(
        `SELECT nombre, valor 
         FROM info_adicional 
         WHERE comprobante_id = $1`,
        [comprobanteId],
      );
      return result.rows;
    } catch (error: any) {
      // Only suppress "table does not exist" (42P01); re-throw everything else
      if (error.code === '42P01') return [];
      throw error;
    }
  }

  /**
   * Obtiene el path del XML autorizado de un comprobante
   */
  async findXmlAutorizado(comprobanteId: string): Promise<string | null> {
    const result = await this.db.queryOne<{ xml_autorizado_path: string }>(
      `SELECT xml_autorizado_path FROM comprobante_xmls WHERE comprobante_id = $1`,
      [comprobanteId],
    );
    return result?.xml_autorizado_path || null;
  }

  /**
   * Obtiene el path del XML firmado de un comprobante
   */
  async findXmlFirmado(comprobanteId: string): Promise<string | null> {
    const result = await this.db.queryOne<{ xml_firmado_path: string }>(
      `SELECT xml_firmado_path FROM comprobante_xmls WHERE comprobante_id = $1`,
      [comprobanteId],
    );
    return result?.xml_firmado_path || null;
  }

  /**
   * Obtiene el registro completo de XMLs de un comprobante
   */
  async findXmlByComprobanteId(comprobanteId: string): Promise<{
    xml_firmado_path?: string;
    xml_autorizado_path?: string;
  } | null> {
    const result = await this.db.queryOne<{
      xml_firmado_path: string;
      xml_autorizado_path: string;
    }>(
      `SELECT xml_firmado_path, xml_autorizado_path FROM comprobante_xmls WHERE comprobante_id = $1`,
      [comprobanteId],
    );
    return result || null;
  }
}
