import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { ClaveAccesoData } from '../interfaces';
import { Ambiente, TipoEmision } from '../constants';

/**
 * Servicio para generar claves de acceso de comprobantes electrónicos
 * según la normativa del SRI Ecuador.
 *
 * La clave de acceso tiene 49 dígitos:
 * - Fecha de emisión (8 dígitos): ddmmaaaa
 * - Tipo de comprobante (2 dígitos)
 * - RUC del emisor (13 dígitos)
 * - Ambiente (1 dígito): 1=Pruebas, 2=Producción
 * - Serie (6 dígitos): Establecimiento + Punto de Emisión
 * - Número secuencial (9 dígitos)
 * - Código numérico (8 dígitos)
 * - Tipo de emisión (1 dígito): 1=Normal, 2=Contingencia
 * - Dígito verificador Módulo 11 (1 dígito)
 */
@Injectable()
export class ClaveAccesoService {
  private readonly logger = new Logger(ClaveAccesoService.name);

  /**
   * Genera una clave de acceso de 49 dígitos
   */
  generate(data: ClaveAccesoData): string {
    this.logger.log('Generando clave de acceso');

    const fecha = this.formatDate(data.fechaEmision);
    const tipoComprobante = data.tipoComprobante.padStart(2, '0');
    const ruc = this.validateRuc(data.ruc);
    const ambiente = data.ambiente || Ambiente.PRUEBAS;
    const establecimiento = data.establecimiento.padStart(3, '0');
    const puntoEmision = data.puntoEmision.padStart(3, '0');
    const secuencial = data.secuencial.padStart(9, '0');
    const codigoNumerico = data.codigoNumerico || this.generateCodigoNumerico();
    const tipoEmision = data.tipoEmision || TipoEmision.NORMAL;

    const claveBase =
      fecha +
      tipoComprobante +
      ruc +
      ambiente +
      establecimiento +
      puntoEmision +
      secuencial +
      codigoNumerico +
      tipoEmision;

    const digitoVerificador = this.calculateModulo11(claveBase);
    const claveAcceso = claveBase + digitoVerificador;

    this.logger.log(`Clave de acceso generada: ${claveAcceso}`);
    return claveAcceso;
  }

  /**
   * Valida una clave de acceso existente
   */
  validate(claveAcceso: string): boolean {
    if (claveAcceso.length !== 49) {
      return false;
    }

    if (!/^\d{49}$/.test(claveAcceso)) {
      return false;
    }

    const claveBase = claveAcceso.substring(0, 48);
    const digitoVerificador = claveAcceso.charAt(48);
    const digitoCalculado = this.calculateModulo11(claveBase);

    return digitoVerificador === digitoCalculado;
  }

  /**
   * Parsea una clave de acceso y extrae sus componentes
   */
  parse(claveAcceso: string): ClaveAccesoData | null {
    if (!this.validate(claveAcceso)) {
      return null;
    }

    const fechaStr = claveAcceso.substring(0, 8);
    const fecha = new Date(
      parseInt(fechaStr.substring(4, 8)),
      parseInt(fechaStr.substring(2, 4)) - 1,
      parseInt(fechaStr.substring(0, 2)),
    );

    return {
      fechaEmision: fecha,
      tipoComprobante: claveAcceso.substring(8, 10) as any,
      ruc: claveAcceso.substring(10, 23),
      ambiente: claveAcceso.charAt(23) as Ambiente,
      establecimiento: claveAcceso.substring(24, 27),
      puntoEmision: claveAcceso.substring(27, 30),
      secuencial: claveAcceso.substring(30, 39),
      codigoNumerico: claveAcceso.substring(39, 47),
      tipoEmision: claveAcceso.charAt(47) as TipoEmision,
    };
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return day + month + year;
  }

  private validateRuc(ruc: string): string {
    const cleanRuc = ruc.replace(/\D/g, '');
    if (cleanRuc.length !== 13) {
      throw new Error(`RUC inválido: debe tener 13 dígitos`);
    }
    return cleanRuc;
  }

  private generateCodigoNumerico(): string {
    return randomInt(10000000, 100000000).toString();
  }

  private calculateModulo11(claveBase: string): string {
    const factores = [2, 3, 4, 5, 6, 7];
    let suma = 0;

    for (let i = claveBase.length - 1, j = 0; i >= 0; i--, j++) {
      const digit = parseInt(claveBase.charAt(i), 10);
      const factor = factores[j % factores.length];
      suma += digit * factor;
    }

    const modulo = suma % 11;
    let digitoVerificador = 11 - modulo;

    if (digitoVerificador === 11) {
      digitoVerificador = 0;
    } else if (digitoVerificador === 10) {
      digitoVerificador = 1;
    }

    return digitoVerificador.toString();
  }
}
