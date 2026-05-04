/**
 * Utilidades para parsing seguro de la Clave de Acceso SRI (49 dígitos).
 *
 * Estructura de la Clave de Acceso:
 * [0-7]   fechaEmision (ddmmaaaa)
 * [8-9]   tipoComprobante (01=factura, 04=nota credito, etc.)
 * [10-22] ruc (13 dígitos)
 * [23-23] tipoAmbiente (1=pruebas, 2=produccion)
 * [24-26] serie (establecimiento 3 dígitos)
 * [27-29] puntoEmision (3 dígitos)
 * [30-38] secuencial (9 dígitos)
 * [39-47] codigoNumerico (9 dígitos)  -- Nota: puede ser 8 dígitos dependiendo de la versión
 * [48-48] digitoVerificador (módulo 11)
 */

export function extractRucFromClaveAcceso(claveAcceso: string): string {
  validateClaveAcceso(claveAcceso);
  return claveAcceso.substring(10, 23);
}

export function extractAmbienteFromClaveAcceso(claveAcceso: string): string {
  validateClaveAcceso(claveAcceso);
  return claveAcceso.substring(23, 24); // '1' = pruebas, '2' = produccion
}

export function extractSecuencialFromClaveAcceso(claveAcceso: string): string {
  validateClaveAcceso(claveAcceso);
  return claveAcceso.substring(30, 39);
}

export function extractTipoComprobanteFromClaveAcceso(
  claveAcceso: string,
): string {
  validateClaveAcceso(claveAcceso);
  return claveAcceso.substring(8, 10);
}

function validateClaveAcceso(claveAcceso: string): void {
  if (!claveAcceso) {
    throw new Error('Clave de acceso no puede ser nula o vacía');
  }
  if (claveAcceso.length !== 49) {
    throw new Error(
      `Clave de acceso inválida: se esperaban 49 dígitos, se recibieron ${claveAcceso.length}. Valor: "${claveAcceso}"`,
    );
  }
  if (!/^\d{49}$/.test(claveAcceso)) {
    throw new Error(
      `Clave de acceso inválida: solo se permiten dígitos numéricos. Valor: "${claveAcceso}"`,
    );
  }
}
