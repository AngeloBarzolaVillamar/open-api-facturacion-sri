export * from './sri.enums';
export * from './sri-endpoints.constant';

/**
 * Descripciones legibles de los tipos de comprobante SRI
 */
export const TIPO_COMPROBANTE_DESCRIPCIONES: Record<string, string> = {
  '01': 'Factura',
  '04': 'Nota de Crédito',
  '05': 'Nota de Débito',
  '06': 'Guía de Remisión',
  '07': 'Comprobante de Retención',
};
