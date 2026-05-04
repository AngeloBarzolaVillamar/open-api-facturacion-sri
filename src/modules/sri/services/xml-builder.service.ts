import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as xml2js from 'xml2js';
import {
  Factura,
  InfoTributaria,
  InfoFactura,
  DetalleFactura,
  NotaCredito,
  InfoNotaCredito,
  DetalleNotaCredito,
  NotaDebito,
  InfoNotaDebito,
  MotivoNotaDebito,
  Retencion,
  InfoRetencion,
  ImpuestoRetenido,
  GuiaRemision,
  InfoGuiaRemision,
  DestinatarioGuiaRemision,
  DetalleGuiaRemision,
} from '../interfaces';
import {
  FACTURA_VERSION,
  NOTA_CREDITO_VERSION,
  NOTA_DEBITO_VERSION,
  RETENCION_VERSION,
  GUIA_REMISION_VERSION,
} from '../constants';

/**
 * Servicio para construir documentos XML de comprobantes electrónicos
 * según los esquemas XSD del SRI Ecuador.
 */
@Injectable()
export class XmlBuilderService {
  private readonly logger = new Logger(XmlBuilderService.name);
  private readonly builder: xml2js.Builder;

  constructor() {
    this.builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' },
      headless: false,
    });
  }

  /**
   * Construye el XML de una factura electrónica
   */
  buildFactura(factura: Factura): string {
    this.logger.log('Construyendo XML de factura');

    const xmlObj = {
      factura: {
        $: {
          id: 'comprobante',
          version: FACTURA_VERSION,
        },
        infoTributaria: this.buildInfoTributaria(factura.infoTributaria),
        infoFactura: this.buildInfoFactura(factura.infoFactura),
        detalles: {
          detalle: factura.detalles.map((d) => this.buildDetalleFactura(d)),
        },
      },
    };

    if (factura.retenciones && factura.retenciones.length > 0) {
      (xmlObj.factura as any).retenciones = {
        retencion: factura.retenciones.map((r) => ({
          codigo: r.codigo,
          codigoPorcentaje: r.codigoPorcentaje,
          tarifa: this.formatDecimal(r.tarifa, 2),
          valor: this.formatDecimal(r.valor, 2),
        })),
      };
    }

    if (factura.infoAdicional && factura.infoAdicional.length > 0) {
      (xmlObj.factura as any).infoAdicional = {
        campoAdicional: factura.infoAdicional.map((campo) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    const xml = this.builder.buildObject(xmlObj);
    this.logger.log('XML de factura construido exitosamente');
    return xml;
  }

  private buildInfoTributaria(info: InfoTributaria): Record<string, any> {
    const result: Record<string, any> = {
      ambiente: info.ambiente,
      tipoEmision: info.tipoEmision,
      razonSocial: info.razonSocial,
    };

    if (info.nombreComercial) {
      result.nombreComercial = info.nombreComercial;
    }

    result.ruc = info.ruc;
    result.claveAcceso = info.claveAcceso;
    result.codDoc = info.codDoc;
    result.estab = info.estab;
    result.ptoEmi = info.ptoEmi;
    result.secuencial = info.secuencial;
    result.dirMatriz = info.dirMatriz;

    if (info.agenteRetencion) {
      result.agenteRetencion = info.agenteRetencion;
    }

    if (info.contribuyenteRimpe) {
      result.contribuyenteRimpe = info.contribuyenteRimpe;
    }

    return result;
  }

  private buildInfoFactura(info: InfoFactura): Record<string, any> {
    const result: Record<string, any> = {
      fechaEmision: info.fechaEmision,
    };

    if (info.dirEstablecimiento) {
      result.dirEstablecimiento = info.dirEstablecimiento;
    }

    if (info.contribuyenteEspecial) {
      result.contribuyenteEspecial = info.contribuyenteEspecial;
    }

    result.obligadoContabilidad = info.obligadoContabilidad;
    result.tipoIdentificacionComprador = info.tipoIdentificacionComprador;

    if (info.guiaRemision) {
      result.guiaRemision = info.guiaRemision;
    }

    result.razonSocialComprador = info.razonSocialComprador;
    result.identificacionComprador = info.identificacionComprador;

    if (info.direccionComprador) {
      result.direccionComprador = info.direccionComprador;
    }

    result.totalSinImpuestos = this.formatDecimal(info.totalSinImpuestos, 2);
    result.totalDescuento = this.formatDecimal(info.totalDescuento, 2);

    result.totalConImpuestos = {
      totalImpuesto: info.totalConImpuestos.map((imp) => ({
        codigo: imp.codigo,
        codigoPorcentaje: imp.codigoPorcentaje,
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        tarifa:
          imp.tarifa !== undefined
            ? this.formatDecimal(imp.tarifa, 2)
            : undefined,
        valor: this.formatDecimal(imp.valor, 2),
      })),
    };

    if (info.propina !== undefined) {
      result.propina = this.formatDecimal(info.propina, 2);
    }

    result.importeTotal = this.formatDecimal(info.importeTotal, 2);

    if (info.moneda) {
      result.moneda = info.moneda;
    }

    result.pagos = {
      pago: info.pagos.map((p) => {
        const pago: Record<string, any> = {
          formaPago: p.formaPago,
          total: this.formatDecimal(p.total, 2),
        };
        if (p.plazo !== undefined) {
          pago.plazo = p.plazo;
          pago.unidadTiempo = p.unidadTiempo || 'dias';
        }
        return pago;
      }),
    };

    return result;
  }

  private buildDetalleFactura(detalle: DetalleFactura): Record<string, any> {
    const result: Record<string, any> = {
      codigoPrincipal: detalle.codigoPrincipal,
    };

    if (detalle.codigoAuxiliar) {
      result.codigoAuxiliar = detalle.codigoAuxiliar;
    }

    result.descripcion = detalle.descripcion;

    if (detalle.unidadMedida) {
      result.unidadMedida = detalle.unidadMedida;
    }

    result.cantidad = this.formatDecimal(detalle.cantidad, 6);
    result.precioUnitario = this.formatDecimal(detalle.precioUnitario, 6);
    result.descuento = this.formatDecimal(detalle.descuento, 2);
    result.precioTotalSinImpuesto = this.formatDecimal(
      detalle.precioTotalSinImpuesto,
      2,
    );

    if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
      result.detallesAdicionales = {
        detAdicional: detalle.detallesAdicionales.map((d) => ({
          $: { nombre: d.nombre, valor: d.valor },
        })),
      };
    }

    result.impuestos = {
      impuesto: detalle.impuestos.map((imp) => ({
        codigo: imp.codigo,
        codigoPorcentaje: imp.codigoPorcentaje,
        tarifa: this.formatDecimal(imp.tarifa, 2),
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        valor: this.formatDecimal(imp.valor, 2),
      })),
    };

    return result;
  }

  private formatDecimal(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  /**
   * Construye el XML de una Nota de Crédito electrónica
   */
  buildNotaCredito(notaCredito: NotaCredito): string {
    this.logger.log('Construyendo XML de nota de crédito');

    const xmlObj = {
      notaCredito: {
        $: {
          id: 'comprobante',
          version: NOTA_CREDITO_VERSION,
        },
        infoTributaria: this.buildInfoTributaria(notaCredito.infoTributaria),
        infoNotaCredito: this.buildInfoNotaCredito(notaCredito.infoNotaCredito),
        detalles: {
          detalle: notaCredito.detalles.map((d) =>
            this.buildDetalleNotaCredito(d),
          ),
        },
      },
    };

    if (notaCredito.infoAdicional && notaCredito.infoAdicional.length > 0) {
      (xmlObj.notaCredito as any).infoAdicional = {
        campoAdicional: notaCredito.infoAdicional.map((campo) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    const xml = this.builder.buildObject(xmlObj);
    this.logger.log('XML de nota de crédito construido exitosamente');
    return xml;
  }

  private buildInfoNotaCredito(info: InfoNotaCredito): Record<string, any> {
    const result: Record<string, any> = {
      fechaEmision: info.fechaEmision,
    };

    if (info.dirEstablecimiento) {
      result.dirEstablecimiento = info.dirEstablecimiento;
    }

    result.tipoIdentificacionComprador = info.tipoIdentificacionComprador;
    result.razonSocialComprador = info.razonSocialComprador;
    result.identificacionComprador = info.identificacionComprador;

    if (info.contribuyenteEspecial) {
      result.contribuyenteEspecial = info.contribuyenteEspecial;
    }

    result.obligadoContabilidad = info.obligadoContabilidad;

    if (info.rise) {
      result.rise = info.rise;
    }

    result.codDocModificado = info.codDocModificado;
    result.numDocModificado = info.numDocModificado;
    result.fechaEmisionDocSustento = info.fechaEmisionDocSustento;
    result.totalSinImpuestos = this.formatDecimal(info.totalSinImpuestos, 2);
    result.valorModificacion = this.formatDecimal(info.valorModificacion, 2);

    if (info.moneda) {
      result.moneda = info.moneda;
    }

    result.totalConImpuestos = {
      totalImpuesto: info.totalConImpuestos.map((imp) => ({
        codigo: imp.codigo,
        codigoPorcentaje: imp.codigoPorcentaje,
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        valor: this.formatDecimal(imp.valor, 2),
      })),
    };

    result.motivo = info.motivo;

    return result;
  }

  private buildDetalleNotaCredito(
    detalle: DetalleNotaCredito,
  ): Record<string, any> {
    const result: Record<string, any> = {
      codigoInterno: detalle.codigoInterno,
    };

    if (detalle.codigoAdicional) {
      result.codigoAdicional = detalle.codigoAdicional;
    }

    result.descripcion = detalle.descripcion;
    result.cantidad = this.formatDecimal(detalle.cantidad, 6);
    result.precioUnitario = this.formatDecimal(detalle.precioUnitario, 6);
    result.descuento = this.formatDecimal(detalle.descuento, 2);
    result.precioTotalSinImpuesto = this.formatDecimal(
      detalle.precioTotalSinImpuesto,
      2,
    );

    if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
      result.detallesAdicionales = {
        detAdicional: detalle.detallesAdicionales.map((d) => ({
          $: { nombre: d.nombre, valor: d.valor },
        })),
      };
    }

    result.impuestos = {
      impuesto: detalle.impuestos.map((imp) => ({
        codigo: imp.codigo,
        codigoPorcentaje: imp.codigoPorcentaje,
        tarifa: this.formatDecimal(imp.tarifa, 2),
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        valor: this.formatDecimal(imp.valor, 2),
      })),
    };

    return result;
  }

  /**
   * Construye el XML de una Nota de Débito electrónica
   */
  buildNotaDebito(notaDebito: NotaDebito): string {
    this.logger.log('Construyendo XML de nota de débito');

    const xmlObj = {
      notaDebito: {
        $: {
          id: 'comprobante',
          version: NOTA_DEBITO_VERSION,
        },
        infoTributaria: this.buildInfoTributaria(notaDebito.infoTributaria),
        infoNotaDebito: this.buildInfoNotaDebito(notaDebito.infoNotaDebito),
        motivos: {
          motivo: notaDebito.motivos.map((m) => this.buildMotivoNotaDebito(m)),
        },
      },
    };

    if (notaDebito.infoAdicional && notaDebito.infoAdicional.length > 0) {
      (xmlObj.notaDebito as any).infoAdicional = {
        campoAdicional: notaDebito.infoAdicional.map((campo) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    const xml = this.builder.buildObject(xmlObj);
    this.logger.log('XML de nota de débito construido exitosamente');
    return xml;
  }

  private buildInfoNotaDebito(info: InfoNotaDebito): Record<string, any> {
    const result: Record<string, any> = {
      fechaEmision: info.fechaEmision,
    };

    if (info.dirEstablecimiento) {
      result.dirEstablecimiento = info.dirEstablecimiento;
    }

    result.tipoIdentificacionComprador = info.tipoIdentificacionComprador;
    result.razonSocialComprador = info.razonSocialComprador;
    result.identificacionComprador = info.identificacionComprador;

    if (info.contribuyenteEspecial) {
      result.contribuyenteEspecial = info.contribuyenteEspecial;
    }

    result.obligadoContabilidad = info.obligadoContabilidad;

    if (info.rise) {
      result.rise = info.rise;
    }

    result.codDocModificado = info.codDocModificado;
    result.numDocModificado = info.numDocModificado;
    result.fechaEmisionDocSustento = info.fechaEmisionDocSustento;
    result.totalSinImpuestos = this.formatDecimal(info.totalSinImpuestos, 2);

    result.impuestos = {
      impuesto: info.impuestos.map((imp) => ({
        codigo: imp.codigo,
        codigoPorcentaje: imp.codigoPorcentaje,
        tarifa:
          imp.tarifa !== undefined
            ? this.formatDecimal(imp.tarifa, 2)
            : undefined,
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        valor: this.formatDecimal(imp.valor, 2),
      })),
    };

    result.valorTotal = this.formatDecimal(info.valorTotal, 2);

    return result;
  }

  private buildMotivoNotaDebito(motivo: MotivoNotaDebito): Record<string, any> {
    return {
      razon: motivo.razon,
      valor: this.formatDecimal(motivo.valor, 2),
    };
  }

  /**
   * Construye el XML de un Comprobante de Retención electrónico v2.0.0
   */
  buildRetencion(retencion: Retencion): string {
    this.logger.log('Construyendo XML de comprobante de retención');

    // Group impuestos by document sustento
    const docsMap = new Map<string, any>();

    for (const imp of retencion.impuestos) {
      const key = `${imp.codDocSustento}-${imp.numDocSustento}`;
      if (!docsMap.has(key)) {
        docsMap.set(key, {
          codSustento: imp.codSustento || imp.codDocSustento,
          codDocSustento: imp.codDocSustento,
          numDocSustento: imp.numDocSustento,
          fechaEmisionDocSustento: imp.fechaEmisionDocSustento,
          pagoLocExt: imp.pagoLocExt || '01', // Default: Local
          totalSinImpuestos: imp.totalSinImpuestos,
          importeTotal: imp.importeTotal,
          formaPago: imp.formaPago || '01',
          impuestosDocSustento: imp.impuestosDocSustento,
          retenciones: [],
        });
      }

      const doc = docsMap.get(key);
      doc.retenciones.push({
        codigo: imp.codigo,
        codigoRetencion: imp.codigoRetencion,
        baseImponible: this.formatDecimal(imp.baseImponible, 2),
        porcentajeRetener: this.formatDecimal(imp.porcentajeRetener, 2),
        valorRetenido: this.formatDecimal(imp.valorRetenido, 2),
      });
    }

    const docsSustento = Array.from(docsMap.values()).map((doc) => ({
      codSustento: doc.codSustento,
      codDocSustento: doc.codDocSustento,
      numDocSustento: doc.numDocSustento.replace(/-/g, ''), // Remove dashes for 15-digit format
      fechaEmisionDocSustento: doc.fechaEmisionDocSustento,
      pagoLocExt: doc.pagoLocExt,
      totalSinImpuestos: this.formatDecimal(doc.totalSinImpuestos, 2),
      importeTotal: this.formatDecimal(doc.importeTotal, 2),
      impuestosDocSustento: {
        impuestoDocSustento: doc.impuestosDocSustento.map((impDoc: any) => ({
          codImpuestoDocSustento: impDoc.codImpuestoDocSustento,
          codigoPorcentaje: impDoc.codigoPorcentaje,
          baseImponible: this.formatDecimal(impDoc.baseImponible, 2),
          tarifa: this.formatDecimal(impDoc.tarifa, 2),
          valorImpuesto: this.formatDecimal(impDoc.valorImpuesto, 2),
        })),
      },
      retenciones: {
        retencion: doc.retenciones,
      },
      pagos: {
        pago: {
          formaPago: doc.formaPago,
          total: this.formatDecimal(doc.importeTotal, 2),
        },
      },
    }));

    const xmlObj = {
      comprobanteRetencion: {
        $: {
          id: 'comprobante',
          version: RETENCION_VERSION,
        },
        infoTributaria: this.buildInfoTributaria(retencion.infoTributaria),
        infoCompRetencion: this.buildInfoRetencion(retencion.infoCompRetencion),
        docsSustento: {
          docSustento: docsSustento,
        },
      },
    };

    if (retencion.infoAdicional && retencion.infoAdicional.length > 0) {
      (xmlObj.comprobanteRetencion as any).infoAdicional = {
        campoAdicional: retencion.infoAdicional.map((campo) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    const xml = this.builder.buildObject(xmlObj);
    this.logger.log('XML de comprobante de retención construido exitosamente');
    return xml;
  }

  private buildInfoRetencion(info: InfoRetencion): Record<string, any> {
    const result: Record<string, any> = {
      fechaEmision: info.fechaEmision,
    };

    if (info.dirEstablecimiento) {
      result.dirEstablecimiento = info.dirEstablecimiento;
    }

    if (info.contribuyenteEspecial) {
      result.contribuyenteEspecial = info.contribuyenteEspecial;
    }

    result.obligadoContabilidad = info.obligadoContabilidad;
    result.tipoIdentificacionSujetoRetenido =
      info.tipoIdentificacionSujetoRetenido;

    // SRI rule: tipoSujetoRetenido must ONLY be included when tipoIdentificacion is 08 (Exterior)
    if (String(info.tipoIdentificacionSujetoRetenido) === '08') {
      if (!info.tipoSujetoRetenido) {
        throw new BadRequestException(
          'tipoSujetoRetenido es requerido para sujetos con identificación del exterior (08). ' +
            'Use "01" para Persona Natural o "02" para Sociedad.',
        );
      }
      result.tipoSujetoRetenido = info.tipoSujetoRetenido;
    }

    result.parteRel = info.parteRel || 'NO';
    result.razonSocialSujetoRetenido = info.razonSocialSujetoRetenido;
    result.identificacionSujetoRetenido = info.identificacionSujetoRetenido;
    result.periodoFiscal = info.periodoFiscal;

    return result;
  }

  private buildImpuestoRetenido(
    impuesto: ImpuestoRetenido,
  ): Record<string, any> {
    return {
      codigo: impuesto.codigo,
      codigoRetencion: impuesto.codigoRetencion,
      baseImponible: this.formatDecimal(impuesto.baseImponible, 2),
      porcentajeRetener: this.formatDecimal(impuesto.porcentajeRetener, 2),
      valorRetenido: this.formatDecimal(impuesto.valorRetenido, 2),
      codDocSustento: impuesto.codDocSustento,
      numDocSustento: impuesto.numDocSustento,
      fechaEmisionDocSustento: impuesto.fechaEmisionDocSustento,
    };
  }

  /**
   * Construye el XML de una Guía de Remisión electrónica
   */
  buildGuiaRemision(guia: GuiaRemision): string {
    this.logger.log('Construyendo XML de guía de remisión');

    const xmlObj = {
      guiaRemision: {
        $: {
          id: 'comprobante',
          version: GUIA_REMISION_VERSION,
        },
        infoTributaria: this.buildInfoTributaria(guia.infoTributaria),
        infoGuiaRemision: this.buildInfoGuiaRemision(guia.infoGuiaRemision),
        destinatarios: {
          destinatario: guia.destinatarios.map((d) =>
            this.buildDestinatario(d),
          ),
        },
      },
    };

    if (guia.infoAdicional && guia.infoAdicional.length > 0) {
      (xmlObj.guiaRemision as any).infoAdicional = {
        campoAdicional: guia.infoAdicional.map((campo) => ({
          $: { nombre: campo.nombre },
          _: campo.valor,
        })),
      };
    }

    const xml = this.builder.buildObject(xmlObj);
    this.logger.log('XML de guía de remisión construido exitosamente');
    return xml;
  }

  private buildInfoGuiaRemision(info: InfoGuiaRemision): Record<string, any> {
    const result: Record<string, any> = {};

    if (info.dirEstablecimiento) {
      result.dirEstablecimiento = info.dirEstablecimiento;
    }

    result.dirPartida = info.dirPartida;
    result.razonSocialTransportista = info.razonSocialTransportista;
    result.tipoIdentificacionTransportista =
      info.tipoIdentificacionTransportista;
    result.rucTransportista = info.rucTransportista;

    if (info.rise) {
      result.rise = info.rise;
    }

    result.obligadoContabilidad = info.obligadoContabilidad;

    if (info.contribuyenteEspecial) {
      result.contribuyenteEspecial = info.contribuyenteEspecial;
    }

    result.fechaIniTransporte = info.fechaIniTransporte;
    result.fechaFinTransporte = info.fechaFinTransporte;
    result.placa = info.placa;

    return result;
  }

  private buildDestinatario(
    dest: DestinatarioGuiaRemision,
  ): Record<string, any> {
    const result: Record<string, any> = {
      tipoIdentificacionDestinatario: dest.tipoIdentificacionDestinatario,
      identificacionDestinatario: dest.identificacionDestinatario,
      razonSocialDestinatario: dest.razonSocialDestinatario,
      dirDestinatario: dest.dirDestinatario,
      motivoTraslado: dest.motivoTraslado,
    };

    if (dest.docAduaneroUnico) {
      result.docAduaneroUnico = dest.docAduaneroUnico;
    }

    if (dest.codEstabDestino) {
      result.codEstabDestino = dest.codEstabDestino;
    }

    if (dest.ruta) {
      result.ruta = dest.ruta;
    }

    if (dest.codDocSustento) {
      result.codDocSustento = dest.codDocSustento;
    }

    if (dest.numDocSustento) {
      result.numDocSustento = dest.numDocSustento;
    }

    if (dest.numAutDocSustento) {
      result.numAutDocSustento = dest.numAutDocSustento;
    }

    if (dest.fechaEmisionDocSustento) {
      result.fechaEmisionDocSustento = dest.fechaEmisionDocSustento;
    }

    result.detalles = {
      detalle: dest.detalles.map((det) => this.buildDetalleGuiaRemision(det)),
    };

    return result;
  }

  private buildDetalleGuiaRemision(
    detalle: DetalleGuiaRemision,
  ): Record<string, any> {
    const result: Record<string, any> = {
      codigoInterno: detalle.codigoInterno,
    };

    if (detalle.codigoAdicional) {
      result.codigoAdicional = detalle.codigoAdicional;
    }

    result.descripcion = detalle.descripcion;
    result.cantidad = this.formatDecimal(detalle.cantidad, 6);

    if (detalle.detallesAdicionales && detalle.detallesAdicionales.length > 0) {
      result.detallesAdicionales = {
        detAdicional: detalle.detallesAdicionales.map((d) => ({
          $: { nombre: d.nombre, valor: d.valor },
        })),
      };
    }

    return result;
  }

  async parseXml<T>(xml: string): Promise<T> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
    });
    return parser.parseStringPromise(xml);
  }
}
