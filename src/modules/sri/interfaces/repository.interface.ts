/**
 * Repository interfaces for SRI module
 */

export interface ComprobanteRecord {
  id?: string;
  emisor_id: string;
  punto_emision_id: string;
  receptor_id?: string;
  tipo_comprobante: string;
  ambiente: string;
  tipo_emision: string;
  secuencial: string;
  clave_acceso: string;
  fecha_emision: string;
  estado: string;
  estado_sri?: string;
  fecha_autorizacion?: string;
  numero_autorizacion?: string;
  total_sin_impuestos?: number;
  total_descuento?: number;
  importe_total?: number;
  propina?: number;
  moneda?: string;
  receptor_tipo_identificacion?: string;
  receptor_identificacion?: string;
  receptor_razon_social?: string;
  receptor_direccion?: string;
  receptor_email?: string;
  receptor_telefono?: string;
  doc_modificado_tipo?: string;
  doc_modificado_numero?: string;
  doc_modificado_fecha?: string;
  motivo?: string;
  valor_modificacion?: number;
  rise?: string;
  periodo_fiscal?: string;
  dir_partida?: string;
  placa?: string;
  ruc_transportista?: string;
  razon_social_transportista?: string;
  tipo_identificacion_transportista?: string;
  fecha_ini_transporte?: string;
  fecha_fin_transporte?: string;
  guia_remision?: string;
  id_referencia_externa?: string;
  tipo_sistema_externo?: string;
}

export interface DetalleRecord {
  id?: string;
  comprobante_id: string;
  producto_id?: string;
  codigo_principal?: string;
  codigo_auxiliar?: string;
  descripcion: string;
  unidad_medida?: string;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  precio_total_sin_impuesto?: number;
  orden?: number;
}

export interface ImpuestoRecord {
  id?: string;
  comprobante_detalle_id: string;
  codigo: string;
  codigo_porcentaje: string;
  tarifa?: number;
  base_imponible?: number;
  valor?: number;
}

export interface TotalRecord {
  id?: string;
  comprobante_id: string;
  codigo: string;
  codigo_porcentaje: string;
  descuento_adicional?: number;
  base_imponible?: number;
  tarifa?: number;
  valor?: number;
  valor_devolucion_iva?: number;
}

export interface PagoRecord {
  id?: string;
  comprobante_id: string;
  forma_pago: string;
  total: number;
  plazo?: number;
  unidad_tiempo?: string;
}

export interface RetencionRecord {
  id?: string;
  comprobante_id: string;
  codigo: string;
  codigo_retencion: string;
  base_imponible?: number;
  porcentaje_retener?: number;
  valor_retenido?: number;
  cod_doc_sustento?: string;
  num_doc_sustento?: string;
  fecha_emision_doc_sustento?: string;
  total_sin_impuestos?: number;
  importe_total?: number;
  pago_loc_ext?: string;
}

export interface ImpuestoDocSustentoRecord {
  id?: string;
  comprobante_retencion_id: string;
  cod_impuesto_doc_sustento: string;
  codigo_porcentaje: string;
  base_imponible?: number;
  tarifa?: number;
  valor_impuesto?: number;
}

export interface XmlRecord {
  id?: string;
  comprobante_id: string;
  xml_firmado_path?: string;
  xml_autorizado_path?: string;
}

export interface InfoAdicionalRecord {
  id?: string;
  comprobante_id: string;
  nombre: string;
  valor: string;
}

export interface DetalleAdicionalRecord {
  id?: string;
  comprobante_detalle_id: string;
  nombre: string;
  valor: string;
}

export interface DestinatarioGuiaRecord {
  id?: string;
  comprobante_id: string;
  identificacion_destinatario: string;
  razon_social_destinatario: string;
  dir_destinatario: string;
  motivo_traslado: string;
  doc_aduanero_unico?: string;
  cod_estab_destino?: string;
  ruta?: string;
  cod_doc_sustento?: string;
  num_doc_sustento?: string;
  num_aut_doc_sustento?: string;
  fecha_emision_doc_sustento?: string;
}

export interface DetalleGuiaRecord {
  id?: string;
  destinatario_id: string;
  codigo_interno: string;
  codigo_adicional?: string;
  descripcion: string;
  cantidad: number;
}

export interface MotivoNotaDebitoRecord {
  id?: string;
  comprobante_id: string;
  razon: string;
  valor: number;
}

export interface EmisorRecord {
  id: string;
  tenant_id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion_matriz: string;
  obligado_contabilidad: boolean;
  contribuyente_especial?: string;
  agente_retencion?: string;
  contribuyente_rimpe: boolean;
  certificado_p12?: Buffer;
  certificado_password?: string;
  // New fields for certificate binding
  certificado_nombre?: string;
  certificado_password_encrypted?: string;
  certificado_valido_hasta?: Date;
  certificado_sujeto?: string;
  certificado_updated_at?: Date;
  ambiente: string;
  estado: string;
}

export interface PuntoEmisionRecord {
  id: string;
  establecimiento_id: string;
  codigo: string;
  descripcion?: string;
  estado: string;
}

export interface EstablecimientoRecord {
  id: string;
  emisor_id: string;
  codigo: string;
  direccion: string;
  estado: string;
}
