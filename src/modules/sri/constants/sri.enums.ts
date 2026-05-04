/**
 * Tipos de comprobantes electrónicos del SRI Ecuador
 */
export enum TipoComprobante {
  FACTURA = '01',
  NOTA_VENTA = '02', // Solo RISE
  LIQUIDACION_COMPRA = '03',
  NOTA_CREDITO = '04',
  NOTA_DEBITO = '05',
  GUIA_REMISION = '06',
  COMPROBANTE_RETENCION = '07',
}

/**
 * Tipos de ambiente del SRI
 */
export enum Ambiente {
  PRUEBAS = '1',
  PRODUCCION = '2',
}

/**
 * Tipos de emisión
 */
export enum TipoEmision {
  NORMAL = '1', // Emisión normal
  CONTINGENCIA = '2', // Emisión por indisponibilidad del sistema
}

/**
 * Tipos de identificación del comprador
 */
export enum TipoIdentificacion {
  RUC = '04',
  CEDULA = '05',
  PASAPORTE = '06',
  CONSUMIDOR_FINAL = '07',
  IDENTIFICACION_EXTERIOR = '08',
  PLACA = '09', // Vehículos
}

/**
 * Códigos de impuesto
 */
export enum CodigoImpuesto {
  IVA = '2',
  ICE = '3',
  IRBPNR = '5', // Impuesto Redimible Botellas Plásticas
}

/**
 * Códigos de porcentaje IVA
 */
export enum CodigoPorcentajeIVA {
  IVA_0 = '0',
  IVA_12 = '2',
  IVA_14 = '3', // Vigente hasta 2016
  IVA_NO_OBJETO = '6',
  IVA_EXENTO = '7',
  IVA_15 = '4', // Vigente desde abril 2024
}

/**
 * Formas de pago
 */
export enum FormaPago {
  SIN_UTILIZACION_SISTEMA_FINANCIERO = '01',
  COMPENSACION_DEUDAS = '15',
  TARJETA_DEBITO = '16',
  DINERO_ELECTRONICO = '17',
  TARJETA_PREPAGO = '18',
  TARJETA_CREDITO = '19',
  OTROS_CON_SISTEMA_FINANCIERO = '20',
  ENDOSO_TITULOS = '21',
}
