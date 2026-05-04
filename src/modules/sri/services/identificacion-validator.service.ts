import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio para validar identificaciones ecuatorianas (Cédula, RUC, Pasaporte)
 */
@Injectable()
export class IdentificacionValidatorService {
  private readonly logger = new Logger(IdentificacionValidatorService.name);

  /**
   * Valida una identificación según su tipo
   * @param tipoIdentificacion Código de tipo de identificación del SRI
   * @param identificacion Número de identificación
   * @returns Objeto con resultado de validación
   */
  validar(
    tipoIdentificacion: string,
    identificacion: string,
  ): { valido: boolean; error?: string } {
    switch (tipoIdentificacion) {
      case '04': // RUC
        return this.validarRuc(identificacion);
      case '05': // Cédula
        return this.validarCedula(identificacion);
      case '06': // Pasaporte
        return this.validarPasaporte(identificacion);
      case '07': // Consumidor final
        return this.validarConsumidorFinal(identificacion);
      case '08': // Identificación del exterior
        return { valido: true }; // No se valida estructura
      default:
        return {
          valido: false,
          error: `Tipo de identificación ${tipoIdentificacion} no reconocido`,
        };
    }
  }

  /**
   * Valida una cédula ecuatoriana usando el algoritmo Módulo 10
   */
  validarCedula(cedula: string): { valido: boolean; error?: string } {
    // Validar que tenga 10 dígitos
    if (!cedula || !/^\d{10}$/.test(cedula)) {
      return {
        valido: false,
        error: 'La cédula debe tener exactamente 10 dígitos numéricos',
      };
    }

    // Validar código de provincia (01-24)
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) {
      return {
        valido: false,
        error: `Código de provincia ${provincia} inválido (debe ser 01-24)`,
      };
    }

    // Validar tercer dígito (tipo de persona: 0-5 para personas naturales)
    const tercerDigito = parseInt(cedula.charAt(2), 10);
    if (tercerDigito > 5) {
      return {
        valido: false,
        error: 'El tercer dígito de la cédula debe ser menor o igual a 5',
      };
    }

    // Algoritmo Módulo 10
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
      let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
      if (valor > 9) {
        valor -= 9;
      }
      suma += valor;
    }

    const residuo = suma % 10;
    const digitoVerificadorCalculado = residuo === 0 ? 0 : 10 - residuo;
    const digitoVerificador = parseInt(cedula.charAt(9), 10);

    if (digitoVerificadorCalculado !== digitoVerificador) {
      return {
        valido: false,
        error: `Dígito verificador incorrecto. Esperado: ${digitoVerificadorCalculado}, recibido: ${digitoVerificador}`,
      };
    }

    return { valido: true };
  }

  /**
   * Valida un RUC ecuatoriano
   * - Persona natural: 13 dígitos, primeros 10 son cédula, últimos 3 son código establecimiento (001)
   * - Sociedad privada: 13 dígitos, tercer dígito es 9, Módulo 11
   * - Sociedad pública: 13 dígitos, tercer dígito es 6, Módulo 11
   */
  validarRuc(ruc: string): { valido: boolean; error?: string } {
    // Validar que tenga 13 dígitos
    if (!ruc || !/^\d{13}$/.test(ruc)) {
      return {
        valido: false,
        error: 'El RUC debe tener exactamente 13 dígitos numéricos',
      };
    }

    // Validar código de provincia
    const provincia = parseInt(ruc.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) {
      return {
        valido: false,
        error: `Código de provincia ${provincia} inválido (debe ser 01-24)`,
      };
    }

    const tercerDigito = parseInt(ruc.charAt(2), 10);

    // Persona natural (tercer dígito 0-5)
    if (tercerDigito >= 0 && tercerDigito <= 5) {
      return this.validarRucPersonaNatural(ruc);
    }

    // Sociedad pública (tercer dígito 6)
    if (tercerDigito === 6) {
      return this.validarRucSociedadPublica(ruc);
    }

    // Sociedad privada (tercer dígito 9)
    if (tercerDigito === 9) {
      return this.validarRucSociedadPrivada(ruc);
    }

    return { valido: false, error: 'Tercer dígito del RUC inválido' };
  }

  /**
   * Valida RUC de persona natural (primeros 10 dígitos = cédula + 001)
   */
  private validarRucPersonaNatural(ruc: string): {
    valido: boolean;
    error?: string;
  } {
    const cedula = ruc.substring(0, 10);
    const establecimiento = ruc.substring(10, 13);

    // Validar que el código de establecimiento sea válido (001, 002, etc.)
    const codEstab = parseInt(establecimiento, 10);
    if (codEstab < 1) {
      return {
        valido: false,
        error: 'Código de establecimiento del RUC inválido',
      };
    }

    // Validar cédula (primeros 10 dígitos)
    const validacionCedula = this.validarCedula(cedula);
    if (!validacionCedula.valido) {
      return {
        valido: false,
        error: `RUC persona natural: ${validacionCedula.error}`,
      };
    }

    return { valido: true };
  }

  /**
   * Valida RUC de sociedad privada usando Módulo 11
   */
  private validarRucSociedadPrivada(ruc: string): {
    valido: boolean;
    error?: string;
  } {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }

    const residuo = suma % 11;
    const digitoVerificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
    const digitoVerificador = parseInt(ruc.charAt(9), 10);

    if (digitoVerificadorCalculado !== digitoVerificador) {
      return {
        valido: false,
        error: `RUC sociedad privada: dígito verificador incorrecto`,
      };
    }

    // Validar que termine en 001
    const establecimiento = ruc.substring(10, 13);
    if (establecimiento !== '001') {
      return {
        valido: false,
        error: 'RUC sociedad privada debe terminar en 001',
      };
    }

    return { valido: true };
  }

  /**
   * Valida RUC de sociedad pública usando Módulo 11
   */
  private validarRucSociedadPublica(ruc: string): {
    valido: boolean;
    error?: string;
  } {
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 8; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }

    const residuo = suma % 11;
    const digitoVerificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
    const digitoVerificador = parseInt(ruc.charAt(8), 10);

    if (digitoVerificadorCalculado !== digitoVerificador) {
      return {
        valido: false,
        error: `RUC sociedad pública: dígito verificador incorrecto`,
      };
    }

    // Validar que termine en 0001
    const establecimiento = ruc.substring(9, 13);
    if (establecimiento !== '0001') {
      return {
        valido: false,
        error: 'RUC sociedad pública debe terminar en 0001',
      };
    }

    return { valido: true };
  }

  /**
   * Valida pasaporte (solo verifica que no esté vacío y tenga longitud razonable)
   */
  validarPasaporte(pasaporte: string): { valido: boolean; error?: string } {
    if (!pasaporte || pasaporte.length < 5 || pasaporte.length > 20) {
      return {
        valido: false,
        error: 'El pasaporte debe tener entre 5 y 20 caracteres',
      };
    }
    return { valido: true };
  }

  /**
   * Valida identificación de consumidor final (9999999999999)
   */
  validarConsumidorFinal(identificacion: string): {
    valido: boolean;
    error?: string;
  } {
    if (identificacion !== '9999999999999') {
      return {
        valido: false,
        error: 'Consumidor final debe usar identificación 9999999999999',
      };
    }
    return { valido: true };
  }
}
