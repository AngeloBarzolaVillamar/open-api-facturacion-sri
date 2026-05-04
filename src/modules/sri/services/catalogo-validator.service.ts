import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

/**
 * Tarifa de impuesto del catálogo
 */
export interface TarifaImpuesto {
  codigo_porcentaje: string;
  descripcion: string;
  porcentaje: number;
  impuesto_codigo: string;
  impuesto_nombre: string;
}

/**
 * Código de retención del catálogo
 */
export interface CodigoRetencion {
  tipo: string;
  codigo: string;
  descripcion: string;
  porcentaje: number;
}

/**
 * Forma de pago del catálogo
 */
export interface FormaPago {
  codigo: string;
  descripcion: string;
}

/**
 * Tipo de identificación del catálogo
 */
export interface TipoIdentificacion {
  codigo: string;
  descripcion: string;
  longitud: number | null;
  regex_validacion: string | null;
}

/**
 * Documento sustento del catálogo
 */
export interface DocumentoSustento {
  codigo: string;
  descripcion: string;
}

/**
 * Motivo traslado del catálogo
 */
export interface MotivoTraslado {
  codigo: string;
  descripcion: string;
}

/**
 * Servicio para validar códigos contra los catálogos almacenados en base de datos
 */
@Injectable()
export class CatalogoValidatorService {
  private readonly logger = new Logger(CatalogoValidatorService.name);

  // Caches para evitar consultas repetitivas
  private tarifasCache: Map<string, TarifaImpuesto> = new Map();
  private retencionesCache: Map<string, CodigoRetencion> = new Map();
  private formasPagoCache: Map<string, FormaPago> = new Map();
  private tiposIdentificacionCache: Map<string, TipoIdentificacion> = new Map();
  private documentosSustentoCache: Map<string, DocumentoSustento> = new Map();
  private motivosTrasladoCache: Map<string, MotivoTraslado> = new Map();

  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
  private loadingPromise: Promise<void> | null = null; // FIX P7: Semáforo anti-carga paralela

  constructor(private readonly db: DatabaseService) {}

  // =====================================================
  // VALIDACIONES DE IMPUESTOS
  // =====================================================

  async validateImpuesto(
    codigoImpuesto: string,
    codigoPorcentaje: string,
  ): Promise<{ valid: boolean; tarifa?: TarifaImpuesto; error?: string }> {
    await this.refreshCacheIfNeeded();

    const key = `${codigoImpuesto}-${codigoPorcentaje}`;
    const tarifa = this.tarifasCache.get(key);

    if (!tarifa) {
      return {
        valid: false,
        error: `Código de impuesto ${codigoImpuesto} con tarifa ${codigoPorcentaje} no encontrado en catálogo`,
      };
    }

    return { valid: true, tarifa };
  }

  async validateImpuestos(
    impuestos: Array<{ codigo: string; codigoPorcentaje: string }>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const imp of impuestos) {
      const result = await this.validateImpuesto(
        imp.codigo,
        imp.codigoPorcentaje,
      );
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // =====================================================
  // VALIDACIONES DE RETENCIONES
  // =====================================================

  async validateRetencion(
    tipo: string,
    codigo: string,
  ): Promise<{ valid: boolean; retencion?: CodigoRetencion; error?: string }> {
    await this.refreshCacheIfNeeded();

    const key = `${tipo}-${codigo}`;
    const retencion = this.retencionesCache.get(key);

    if (!retencion) {
      return {
        valid: false,
        error: `Código de retención ${codigo} de tipo ${tipo} no encontrado en catálogo`,
      };
    }

    return { valid: true, retencion };
  }

  async validateRetenciones(
    retenciones: Array<{ codigo: string; codigoRetencion: string }>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const ret of retenciones) {
      let tipo = 'RENTA';
      if (ret.codigoRetencion.startsWith('7')) {
        tipo = 'IVA';
      } else if (ret.codigoRetencion.startsWith('45')) {
        tipo = 'ISD';
      }

      const result = await this.validateRetencion(tipo, ret.codigoRetencion);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // =====================================================
  // VALIDACIONES DE FORMAS DE PAGO
  // =====================================================

  async validateFormaPago(
    codigo: string,
  ): Promise<{ valid: boolean; formaPago?: FormaPago; error?: string }> {
    await this.refreshCacheIfNeeded();

    const formaPago = this.formasPagoCache.get(codigo);

    if (!formaPago) {
      return {
        valid: false,
        error: `Forma de pago ${codigo} no encontrada en catálogo`,
      };
    }

    return { valid: true, formaPago };
  }

  async validateFormasPago(
    pagos: Array<{ formaPago: string }>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const pago of pagos) {
      const result = await this.validateFormaPago(pago.formaPago);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // =====================================================
  // VALIDACIONES DE TIPOS DE IDENTIFICACIÓN
  // =====================================================

  async validateTipoIdentificacion(codigo: string): Promise<{
    valid: boolean;
    tipoIdentificacion?: TipoIdentificacion;
    error?: string;
  }> {
    await this.refreshCacheIfNeeded();

    const tipoIdentificacion = this.tiposIdentificacionCache.get(codigo);

    if (!tipoIdentificacion) {
      return {
        valid: false,
        error: `Tipo de identificación ${codigo} no encontrado en catálogo`,
      };
    }

    return { valid: true, tipoIdentificacion };
  }

  // =====================================================
  // VALIDACIONES DE DOCUMENTOS SUSTENTO
  // =====================================================

  async validateDocumentoSustento(codigo: string): Promise<{
    valid: boolean;
    documentoSustento?: DocumentoSustento;
    error?: string;
  }> {
    await this.refreshCacheIfNeeded();

    const documentoSustento = this.documentosSustentoCache.get(codigo);

    if (!documentoSustento) {
      return {
        valid: false,
        error: `Documento sustento ${codigo} no encontrado en catálogo`,
      };
    }

    return { valid: true, documentoSustento };
  }

  // =====================================================
  // VALIDACIONES DE MOTIVOS TRASLADO (Guía Remisión)
  // =====================================================

  async validateMotivoTraslado(codigo: string): Promise<{
    valid: boolean;
    motivoTraslado?: MotivoTraslado;
    error?: string;
  }> {
    await this.refreshCacheIfNeeded();

    const motivoTraslado = this.motivosTrasladoCache.get(codigo);

    if (!motivoTraslado) {
      return {
        valid: false,
        error: `Motivo de traslado ${codigo} no encontrado en catálogo`,
      };
    }

    return { valid: true, motivoTraslado };
  }

  // =====================================================
  // MÉTODOS DE CONSULTA
  // =====================================================

  async getTarifasVigentes(codigoImpuesto: string): Promise<TarifaImpuesto[]> {
    await this.refreshCacheIfNeeded();
    const tarifas: TarifaImpuesto[] = [];
    for (const [, tarifa] of this.tarifasCache) {
      if (tarifa.impuesto_codigo === codigoImpuesto) {
        tarifas.push(tarifa);
      }
    }
    return tarifas;
  }

  async getRetencionesPorTipo(tipo: string): Promise<CodigoRetencion[]> {
    await this.refreshCacheIfNeeded();
    const retenciones: CodigoRetencion[] = [];
    for (const [, retencion] of this.retencionesCache) {
      if (retencion.tipo === tipo) {
        retenciones.push(retencion);
      }
    }
    return retenciones;
  }

  async getFormasPago(): Promise<FormaPago[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.formasPagoCache.values());
  }

  async getTiposIdentificacion(): Promise<TipoIdentificacion[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.tiposIdentificacionCache.values());
  }

  async getDocumentosSustento(): Promise<DocumentoSustento[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.documentosSustentoCache.values());
  }

  async getMotivosTraslado(): Promise<MotivoTraslado[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.motivosTrasladoCache.values());
  }

  // =====================================================
  // CARGA DE CACHE
  // =====================================================

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now > this.cacheExpiry) {
      // Si ya hay una carga en curso, esperamos que termine en lugar de lanzar otra
      if (this.loadingPromise) {
        return this.loadingPromise;
      }
      this.loadingPromise = this.loadCache()
        .then(() => {
          this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
        })
        .finally(() => {
          this.loadingPromise = null;
        });
      return this.loadingPromise;
    }
  }

  private async loadCache(): Promise<void> {
    this.logger.log('Cargando todos los catálogos SRI...');

    try {
      // 1. Cargar tarifas de impuestos
      const tarifas = await this.db.query<any>(`
        SELECT 
          t.codigo_porcentaje, t.descripcion, t.porcentaje,
          i.codigo as impuesto_codigo, i.nombre as impuesto_nombre
        FROM catalogo_tarifas_impuesto t
        JOIN catalogo_impuestos i ON t.impuesto_id = i.id
        WHERE t.activo = true
        AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= CURRENT_DATE)
      `);
      this.tarifasCache.clear();
      for (const tarifa of tarifas.rows) {
        const key = `${tarifa.impuesto_codigo}-${tarifa.codigo_porcentaje}`;
        this.tarifasCache.set(key, {
          codigo_porcentaje: tarifa.codigo_porcentaje,
          descripcion: tarifa.descripcion,
          porcentaje: parseFloat(tarifa.porcentaje),
          impuesto_codigo: tarifa.impuesto_codigo,
          impuesto_nombre: tarifa.impuesto_nombre,
        });
      }

      // 2. Cargar códigos de retención
      const retenciones = await this.db.query<any>(`
        SELECT tipo, codigo, descripcion, porcentaje
        FROM catalogo_retenciones WHERE activo = true
        AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
      `);
      this.retencionesCache.clear();
      for (const ret of retenciones.rows) {
        const key = `${ret.tipo}-${ret.codigo}`;
        this.retencionesCache.set(key, {
          tipo: ret.tipo,
          codigo: ret.codigo,
          descripcion: ret.descripcion,
          porcentaje: parseFloat(ret.porcentaje),
        });
      }

      // 3. Cargar formas de pago
      const formasPago = await this.db.query<any>(`
        SELECT codigo, descripcion FROM catalogo_formas_pago WHERE activo = true
      `);
      this.formasPagoCache.clear();
      for (const fp of formasPago.rows) {
        this.formasPagoCache.set(fp.codigo, {
          codigo: fp.codigo,
          descripcion: fp.descripcion,
        });
      }

      // 4. Cargar tipos de identificación
      const tiposIdent = await this.db.query<any>(`
        SELECT codigo, descripcion, longitud, regex_validacion 
        FROM catalogo_tipos_identificacion WHERE activo = true
      `);
      this.tiposIdentificacionCache.clear();
      for (const ti of tiposIdent.rows) {
        this.tiposIdentificacionCache.set(ti.codigo, {
          codigo: ti.codigo,
          descripcion: ti.descripcion,
          longitud: ti.longitud,
          regex_validacion: ti.regex_validacion,
        });
      }

      // 5. Cargar documentos sustento
      const docsSustento = await this.db.query<any>(`
        SELECT codigo, descripcion FROM catalogo_documentos_sustento WHERE activo = true
      `);
      this.documentosSustentoCache.clear();
      for (const ds of docsSustento.rows) {
        this.documentosSustentoCache.set(ds.codigo, {
          codigo: ds.codigo,
          descripcion: ds.descripcion,
        });
      }

      // 6. Cargar motivos traslado
      const motivosTraslado = await this.db.query<any>(`
        SELECT codigo, descripcion FROM catalogo_motivos_traslado WHERE activo = true
      `);
      this.motivosTrasladoCache.clear();
      for (const mt of motivosTraslado.rows) {
        this.motivosTrasladoCache.set(mt.codigo, {
          codigo: mt.codigo,
          descripcion: mt.descripcion,
        });
      }

      this.logger.log(
        `Catálogos cargados: ${this.tarifasCache.size} tarifas, ` +
          `${this.retencionesCache.size} retenciones, ${this.formasPagoCache.size} formas pago, ` +
          `${this.tiposIdentificacionCache.size} tipos ident, ${this.documentosSustentoCache.size} docs sustento, ` +
          `${this.motivosTrasladoCache.size} motivos traslado`,
      );
    } catch (error) {
      this.logger.error(
        `Error cargando catálogos: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async forceRefreshCache(): Promise<void> {
    this.cacheExpiry = 0;
    await this.refreshCacheIfNeeded();
  }
}
