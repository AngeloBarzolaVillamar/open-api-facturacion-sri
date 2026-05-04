import {
  TipoComprobante,
  Ambiente,
  TipoEmision,
  TipoIdentificacion,
  FormaPago,
} from '../constants';

/**
 * Información tributaria común a todos los comprobantes
 */
export interface InfoTributaria {
  ambiente: Ambiente;
  tipoEmision: TipoEmision;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso?: string;
  codDoc: TipoComprobante;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
  agenteRetencion?: string;
  contribuyenteRimpe?: 'CONTRIBUYENTE RÉGIMEN RIMPE';
}

/**
 * Información de la factura
 */
export interface InfoFactura {
  fechaEmision: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  comercioExterior?: 'EXPORTADOR';
  incoTermFactura?: string;
  lugarIncoTerm?: string;
  paisOrigen?: string;
  puertoEmbarque?: string;
  puertoDestino?: string;
  paisDestino?: string;
  paisAdquisicion?: string;
  tipoIdentificacionComprador: TipoIdentificacion;
  guiaRemision?: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalSubsidio?: number;
  incoTermTotalSinImpuestos?: string;
  totalDescuento: number;
  totalConImpuestos: TotalImpuesto[];
  propina?: number;
  fleteInternacional?: number;
  seguroInternacional?: number;
  gastosAduaneros?: number;
  gastosTransporteOtros?: number;
  importeTotal: number;
  moneda?: string;
  pagos: Pago[];
  valorRetIva?: number;
  valorRetRenta?: number;
}

/**
 * Detalle de productos/servicios
 */
export interface DetalleFactura {
  codigoPrincipal: string;
  codigoAuxiliar?: string;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: DetalleAdicional[];
  impuestos: ImpuestoDetalle[];
}

export interface DetalleAdicional {
  nombre: string;
  valor: string;
}

export interface ImpuestoDetalle {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface TotalImpuesto {
  codigo: string;
  codigoPorcentaje: string;
  descuentoAdicional?: number;
  baseImponible: number;
  tarifa?: number;
  valor: number;
  valorDevolucionIva?: number;
}

export interface Pago {
  formaPago: FormaPago;
  total: number;
  plazo?: number;
  unidadTiempo?: 'dias' | 'meses' | 'años';
}

/**
 * Información adicional del comprobante
 */
export interface CampoAdicional {
  nombre: string;
  valor: string;
}

/**
 * Estructura completa de una factura electrónica
 */
export interface Factura {
  infoTributaria: InfoTributaria;
  infoFactura: InfoFactura;
  detalles: DetalleFactura[];
  infoAdicional?: CampoAdicional[];
  retenciones?: RetencionFactura[];
}

export interface RetencionFactura {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: number;
  valor: number;
}

/**
 * Información específica de la Nota de Crédito
 */
export interface InfoNotaCredito {
  fechaEmision: string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: TipoIdentificacion;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: number;
  valorModificacion: number;
  moneda?: string;
  totalConImpuestos: TotalImpuesto[];
  motivo: string;
}

/**
 * Detalle de Nota de Crédito
 */
export interface DetalleNotaCredito {
  codigoInterno: string;
  codigoAdicional?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  detallesAdicionales?: DetalleAdicional[];
  impuestos: ImpuestoDetalle[];
}

/**
 * Estructura completa de una Nota de Crédito electrónica
 */
export interface NotaCredito {
  infoTributaria: InfoTributaria;
  infoNotaCredito: InfoNotaCredito;
  detalles: DetalleNotaCredito[];
  infoAdicional?: CampoAdicional[];
}

/**
 * Información específica de la Nota de Débito
 */
export interface InfoNotaDebito {
  fechaEmision: string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: TipoIdentificacion;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: number;
  impuestos: TotalImpuesto[];
  valorTotal: number;
}

/**
 * Motivo/Razón de la Nota de Débito
 */
export interface MotivoNotaDebito {
  razon: string;
  valor: number;
}

/**
 * Estructura completa de una Nota de Débito electrónica
 */
export interface NotaDebito {
  infoTributaria: InfoTributaria;
  infoNotaDebito: InfoNotaDebito;
  motivos: MotivoNotaDebito[];
  infoAdicional?: CampoAdicional[];
}

/**
 * Información específica del Comprobante de Retención
 */
export interface InfoRetencion {
  fechaEmision: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  tipoIdentificacionSujetoRetenido: TipoIdentificacion;
  tipoSujetoRetenido?: '01' | '02'; // 01 = Persona Natural, 02 = Sociedad
  parteRel?: 'SI' | 'NO'; // Parte relacionada
  razonSocialSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  periodoFiscal: string;
}

/**
 * Impuesto del documento sustento
 */
export interface ImpuestoDocSustento {
  codImpuestoDocSustento: string;
  codigoPorcentaje: string;
  baseImponible: number;
  tarifa: number;
  valorImpuesto: number;
}

/**
 * Impuesto retenido en el comprobante
 */
export interface ImpuestoRetenido {
  codigo: string; // 1=Renta, 2=IVA, 6=ISD
  codigoRetencion: string;
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
  codDocSustento: string;
  codSustento?: string; // Tipo sustento tributario (distinto de codDocSustento)
  numDocSustento: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: number;
  importeTotal: number;
  pagoLocExt?: '01' | '02'; // 01=Local (default), 02=Exterior
  formaPago?: string; // 01=Sin sist. financiero (default), 16=Tarjeta débito, etc.
  impuestosDocSustento: ImpuestoDocSustento[];
}

/**
 * Estructura completa de un Comprobante de Retención electrónico
 */
export interface Retencion {
  infoTributaria: InfoTributaria;
  infoCompRetencion: InfoRetencion;
  impuestos: ImpuestoRetenido[];
  infoAdicional?: CampoAdicional[];
}

/**
 * Información específica de la Guía de Remisión
 */
export interface InfoGuiaRemision {
  dirEstablecimiento?: string;
  dirPartida: string;
  razonSocialTransportista: string;
  tipoIdentificacionTransportista: TipoIdentificacion;
  rucTransportista: string;
  rise?: string;
  obligadoContabilidad: 'SI' | 'NO';
  contribuyenteEspecial?: string;
  fechaIniTransporte: string;
  fechaFinTransporte: string;
  placa: string;
}

/**
 * Detalle de producto en la Guía de Remisión
 */
export interface DetalleGuiaRemision {
  codigoInterno: string;
  codigoAdicional?: string;
  descripcion: string;
  cantidad: number;
  detallesAdicionales?: DetalleAdicional[];
}

/**
 * Destinatario de la Guía de Remisión
 */
export interface DestinatarioGuiaRemision {
  tipoIdentificacionDestinatario: string;
  identificacionDestinatario: string;
  razonSocialDestinatario: string;
  dirDestinatario: string;
  emailDestinatario?: string;
  motivoTraslado: string;
  docAduaneroUnico?: string;
  codEstabDestino?: string;
  ruta?: string;
  codDocSustento?: string;
  numDocSustento?: string;
  numAutDocSustento?: string;
  fechaEmisionDocSustento?: string;
  detalles: DetalleGuiaRemision[];
}

/**
 * Estructura completa de una Guía de Remisión electrónica
 */
export interface GuiaRemision {
  infoTributaria: InfoTributaria;
  infoGuiaRemision: InfoGuiaRemision;
  destinatarios: DestinatarioGuiaRemision[];
  infoAdicional?: CampoAdicional[];
}
