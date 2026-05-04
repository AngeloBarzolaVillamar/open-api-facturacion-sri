import { FacturaService } from './factura.service';

/**
 * Tests unitarios para la aritmética fiscal con Decimal.js.
 * Se accede al método privado calculateTotales usando (service as any).
 */
describe('FacturaService — calculateTotales (Decimal.js)', () => {
  let service: any;

  beforeEach(() => {
    // Crear instancia mínima — calculateTotales es privado pero no depende de DI
    service = Object.create(FacturaService.prototype);
  });

  it('debe sumar totales sin pérdida de precisión IEEE 754', () => {
    // 0.1 + 0.2 en JS nativo = 0.30000000000000004
    const detalles = [
      {
        precioTotalSinImpuesto: 0.1,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 0.1,
            valor: 0.015,
          },
        ],
      },
      {
        precioTotalSinImpuesto: 0.2,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 0.2,
            valor: 0.03,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalSinImpuestos).toBe(0.3); // NOT 0.30000000000000004
    expect(result.totalDescuento).toBe(0);
  });

  it('debe acumular impuestos por código correctamente', () => {
    const detalles = [
      {
        precioTotalSinImpuesto: 10,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 10,
            valor: 1.5,
          },
        ],
      },
      {
        precioTotalSinImpuesto: 20,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 20,
            valor: 3.0,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalSinImpuestos).toBe(30);
    expect(result.totalConImpuestos).toHaveLength(1);
    expect(result.totalConImpuestos[0].baseImponible).toBe(30);
    expect(result.totalConImpuestos[0].valor).toBe(4.5);
    expect(result.importeTotal).toBe(34.5);
  });

  it('debe manejar múltiples tarifas de impuesto separadas', () => {
    const detalles = [
      {
        precioTotalSinImpuesto: 100,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 100,
            valor: 15,
          },
        ],
      },
      {
        precioTotalSinImpuesto: 50,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            tarifa: 0,
            baseImponible: 50,
            valor: 0,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalSinImpuestos).toBe(150);
    expect(result.totalConImpuestos).toHaveLength(2);
    expect(result.importeTotal).toBe(165);
  });

  it('debe redondear importeTotal a 2 decimales', () => {
    const detalles = [
      {
        precioTotalSinImpuesto: 0.17,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 0.17,
            valor: 0.03,
          },
        ],
      },
      {
        precioTotalSinImpuesto: 0.19,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 0.19,
            valor: 0.03,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalSinImpuestos).toBe(0.36);
    expect(result.totalConImpuestos[0].valor).toBe(0.06);
    expect(result.importeTotal).toBe(0.42);
  });

  it('debe acumular descuentos correctamente', () => {
    const detalles = [
      {
        precioTotalSinImpuesto: 8,
        descuento: 2,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 8,
            valor: 1.2,
          },
        ],
      },
      {
        precioTotalSinImpuesto: 15,
        descuento: 5,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '4',
            tarifa: 15,
            baseImponible: 15,
            valor: 2.25,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalDescuento).toBe(7);
    expect(result.totalSinImpuestos).toBe(23);
    expect(result.importeTotal).toBe(26.45);
  });

  it('debe manejar un solo detalle sin impuestos (IVA 0%)', () => {
    const detalles = [
      {
        precioTotalSinImpuesto: 100,
        descuento: 0,
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            tarifa: 0,
            baseImponible: 100,
            valor: 0,
          },
        ],
      },
    ];

    const result = service.calculateTotales(detalles);
    expect(result.totalSinImpuestos).toBe(100);
    expect(result.importeTotal).toBe(100);
  });
});
