import { TipoComprobante, Ambiente, TipoEmision } from '../constants';

/**
 * Respuesta del servicio de recepción de comprobantes del SRI
 */
export interface SriRecepcionResponse {
  estado: 'RECIBIDA' | 'DEVUELTA';
  comprobantes?: {
    comprobante: SriComprobanteRecepcion[];
  };
}

export interface SriComprobanteRecepcion {
  claveAcceso: string;
  mensajes?: {
    mensaje: SriMensaje[];
  };
}

/**
 * Respuesta del servicio de autorización de comprobantes del SRI
 */
export interface SriAutorizacionResponse {
  claveAccesoConsultada: string;
  numeroComprobantes: string;
  autorizaciones?: {
    autorizacion: SriAutorizacion[];
  };
}

export interface SriAutorizacion {
  estado: 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente: string;
  comprobante?: string;
  mensajes?: {
    mensaje: SriMensaje[];
  };
}

/**
 * Mensaje de respuesta del SRI (error o informativo)
 */
export interface SriMensaje {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo: 'ERROR' | 'ADVERTENCIA' | 'INFORMATIVO';
}

/**
 * Resultado unificado de operaciones con el SRI
 */
export interface SriOperationResult {
  success: boolean;
  claveAcceso: string;
  estado: string;
  fechaAutorizacion?: string;
  numeroAutorizacion?: string;
  xmlAutorizado?: string;
  mensajes: SriMensaje[];
}

/**
 * Datos básicos para generar clave de acceso
 */
export interface ClaveAccesoData {
  fechaEmision: Date;
  tipoComprobante: TipoComprobante;
  ruc: string;
  ambiente: Ambiente;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  codigoNumerico?: string;
  tipoEmision: TipoEmision;
}
