import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFacturaDto } from './factura.dto';
import {
  EmisorDto,
  CompradorDto,
  DetalleFacturaDto,
  PagoDto,
  CampoAdicionalDto,
} from './common.dto';
import { Ambiente, TipoEmision, TipoIdentificacion, FormaPago } from '../constants';

/**
 * Tests unitarios para la validación de CreateFacturaDto y sus DTOs anidados.
 * Verifica que los decoradores class-validator funcionen correctamente.
 */
describe('CreateFacturaDto — Validación', () => {
  // ==========================================
  // Helper: DTO válido completo
  // ==========================================
  function createValidDto(): CreateFacturaDto {
    return plainToInstance(CreateFacturaDto, {
      fechaEmision: '07/02/2026',
      emisor: {
        ruc: '0924383631001',
        razonSocial: 'Empresa Test S.A.',
        dirMatriz: 'Av. Amazonas 123, Quito',
        establecimiento: '001',
        puntoEmision: '001',
        obligadoContabilidad: 'SI',
      },
      comprador: {
        tipoIdentificacion: TipoIdentificacion.CEDULA,
        identificacion: '1710034065',
        razonSocial: 'Juan Pérez',
      },
      detalles: [
        {
          codigoPrincipal: 'PROD001',
          descripcion: 'Servicio de consultoría',
          cantidad: 2,
          precioUnitario: 100,
          descuento: 0,
          impuestos: [
            {
              codigo: '2',
              codigoPorcentaje: '2',
              tarifa: 12,
              baseImponible: 200,
              valor: 24,
            },
          ],
        },
      ],
      pagos: [
        {
          formaPago: FormaPago.SIN_UTILIZACION_SISTEMA_FINANCIERO,
          total: 224,
        },
      ],
    });
  }

  async function getErrors(dto: CreateFacturaDto): Promise<string[]> {
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.values(e.constraints || {}));
  }

  // ==========================================
  // U-DTO-EMI-01: DTO válido pasa validación
  // ==========================================
  it('U-DTO-EMI-01: DTO válido pasa validación sin errores', async () => {
    const dto = createValidDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // ==========================================
  // U-DTO-EMI-02: Sin fechaEmision
  // ==========================================
  it('U-DTO-EMI-02: Sin fechaEmision debe fallar', async () => {
    const dto = createValidDto();
    delete (dto as any).fechaEmision;
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('must be a string'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-03: fechaEmision formato inválido
  // ==========================================
  it('U-DTO-EMI-03: fechaEmision con formato inválido debe fallar', async () => {
    const dto = createValidDto();
    dto.fechaEmision = '2026-02-07';
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('formato dd/mm/yyyy'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-04: Sin emisor
  // ==========================================
  it('U-DTO-EMI-04: Emisor vacío debe fallar validación anidada', async () => {
    const dto = createValidDto();
    (dto as any).emisor = {};
    const errors = await validate(dto);
    const emisorErrors = errors.find((e) => e.property === 'emisor');
    expect(emisorErrors).toBeDefined();
    expect((emisorErrors?.children || []).length).toBeGreaterThan(0);
  });

  // ==========================================
  // U-DTO-EMI-05: Emisor RUC no 13 dígitos
  // ==========================================
  it('U-DTO-EMI-05: Emisor RUC con menos de 13 dígitos debe fallar', async () => {
    const dto = createValidDto();
    dto.emisor.ruc = '09243836310';
    const errors = await validate(dto);
    const emisorErrors = errors.find((e) => e.property === 'emisor');
    expect(emisorErrors).toBeDefined();
    const childErrors = emisorErrors!.children || [];
    const rucError = childErrors.find((c) => c.property === 'ruc');
    expect(rucError).toBeDefined();
    const constraints = Object.values(rucError?.constraints || {});
    expect(constraints.some((m) => m.includes('13'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-06: Sin comprador
  // ==========================================
  it('U-DTO-EMI-06: Comprador vacío debe fallar validación anidada', async () => {
    const dto = createValidDto();
    (dto as any).comprador = {};
    const errors = await validate(dto);
    const compradorErrors = errors.find((e) => e.property === 'comprador');
    expect(compradorErrors).toBeDefined();
    expect((compradorErrors?.children || []).length).toBeGreaterThan(0);
  });

  // ==========================================
  // U-DTO-EMI-07: Sin detalles
  // ==========================================
  it('U-DTO-EMI-07: Sin detalles debe fallar', async () => {
    const dto = createValidDto();
    delete (dto as any).detalles;
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('detalles'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-08: Detalle sin descripcion
  // ==========================================
  it('U-DTO-EMI-08: Detalle sin descripcion debe fallar', async () => {
    const dto = createValidDto();
    dto.detalles[0].descripcion = '';
    const errors = await validate(dto);
    const detallesErrors = errors.find((e) => e.property === 'detalles');
    expect(detallesErrors).toBeDefined();
    // Array items are nested: children[0] = first array element, then .children for property errors
    const itemErrors = (detallesErrors?.children || []).flatMap((c) => c.children || []);
    const descError = itemErrors.find((c) => c.property === 'descripcion');
    expect(descError).toBeDefined();
  });

  // ==========================================
  // U-DTO-EMI-09: Detalle cantidad ≤ 0
  // ==========================================
  it('U-DTO-EMI-09: Detalle con cantidad negativa debe fallar', async () => {
    const dto = createValidDto();
    dto.detalles[0].cantidad = -1;
    const errors = await validate(dto);
    const detallesErrors = errors.find((e) => e.property === 'detalles');
    expect(detallesErrors).toBeDefined();
    const itemErrors = (detallesErrors?.children || []).flatMap((c) => c.children || []);
    const cantError = itemErrors.find((c) => c.property === 'cantidad');
    expect(cantError).toBeDefined();
    const constraintKeys = Object.keys(cantError?.constraints || {});
    expect(constraintKeys).toContain('min');
  });

  // ==========================================
  // U-DTO-EMI-10: Detalle precioUnitario ≤ 0
  // ==========================================
  it('U-DTO-EMI-10: Detalle con precioUnitario negativo debe fallar', async () => {
    const dto = createValidDto();
    dto.detalles[0].precioUnitario = -50;
    const errors = await validate(dto);
    const detallesErrors = errors.find((e) => e.property === 'detalles');
    expect(detallesErrors).toBeDefined();
    const itemErrors = (detallesErrors?.children || []).flatMap((c) => c.children || []);
    const precioError = itemErrors.find((c) => c.property === 'precioUnitario');
    expect(precioError).toBeDefined();
    const constraintKeys = Object.keys(precioError?.constraints || {});
    expect(constraintKeys).toContain('min');
  });

  // ==========================================
  // U-DTO-EMI-11: Sin pagos
  // ==========================================
  it('U-DTO-EMI-11: Sin pagos debe fallar', async () => {
    const dto = createValidDto();
    delete (dto as any).pagos;
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('pagos'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-12: Pago sin formaPago
  // ==========================================
  it('U-DTO-EMI-12: Pago con formaPago inválido debe fallar', async () => {
    const dto = createValidDto();
    (dto.pagos[0] as any).formaPago = '99';
    const errors = await validate(dto);
    const pagosErrors = errors.find((e) => e.property === 'pagos');
    expect(pagosErrors).toBeDefined();
    const itemErrors = (pagosErrors?.children || []).flatMap((c) => c.children || []);
    const formaPagoError = itemErrors.find((c) => c.property === 'formaPago');
    expect(formaPagoError).toBeDefined();
  });

  // ==========================================
  // U-DTO-EMI-13: ambiente inválido
  // ==========================================
  it('U-DTO-EMI-13: ambiente inválido debe fallar', async () => {
    const dto = createValidDto();
    (dto as any).ambiente = '9';
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('ambiente'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-14: tipoEmision inválido
  // ==========================================
  it('U-DTO-EMI-14: tipoEmision inválido debe fallar', async () => {
    const dto = createValidDto();
    (dto as any).tipoEmision = '9';
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('tipoEmision'))).toBe(true);
  });

  // ==========================================
  // U-DTO-EMI-15: secuencial alfanumérico
  // ==========================================
  it('U-DTO-EMI-15: secuencial alfanumérico debe fallar', async () => {
    const dto = createValidDto();
    dto.secuencial = 'ABC123';
    const errors = await getErrors(dto);
    expect(errors.some((m) => m.includes('secuencial'))).toBe(true);
  });
});

// ==========================================
// Tests adicionales para DTOs anidados
// ==========================================
describe('EmisorDto — Validación', () => {
  function createValidEmisor(): EmisorDto {
    return plainToInstance(EmisorDto, {
      ruc: '0924383631001',
      razonSocial: 'Empresa Test S.A.',
      dirMatriz: 'Av. Amazonas 123, Quito',
      establecimiento: '001',
      puntoEmision: '001',
      obligadoContabilidad: 'SI',
    });
  }

  it('EmisorDto válido pasa validación', async () => {
    const errors = await validate(createValidEmisor());
    expect(errors).toHaveLength(0);
  });

  it('RUC con letras debe fallar', async () => {
    const emisor = createValidEmisor();
    emisor.ruc = '09243A3631001';
    const errors = await validate(emisor);
    expect(errors.some((e) => e.property === 'ruc')).toBe(true);
  });

  it('establecimiento con 2 dígitos debe fallar', async () => {
    const emisor = createValidEmisor();
    emisor.establecimiento = '01';
    const errors = await validate(emisor);
    expect(errors.some((e) => e.property === 'establecimiento')).toBe(true);
  });

  it('puntoEmision con 4 dígitos debe fallar', async () => {
    const emisor = createValidEmisor();
    emisor.puntoEmision = '0001';
    const errors = await validate(emisor);
    expect(errors.some((e) => e.property === 'puntoEmision')).toBe(true);
  });

  it('obligadoContabilidad inválido debe fallar', async () => {
    const emisor = createValidEmisor();
    (emisor as any).obligadoContabilidad = 'TALVEZ';
    const errors = await validate(emisor);
    expect(errors.some((e) => e.property === 'obligadoContabilidad')).toBe(true);
  });
});

describe('CompradorDto — Validación', () => {
  function createValidComprador(): CompradorDto {
    return plainToInstance(CompradorDto, {
      tipoIdentificacion: TipoIdentificacion.CEDULA,
      identificacion: '1710034065',
      razonSocial: 'Juan Pérez',
    });
  }

  it('CompradorDto válido pasa validación', async () => {
    const errors = await validate(createValidComprador());
    expect(errors).toHaveLength(0);
  });

  it('tipoIdentificacion inválido debe fallar', async () => {
    const comprador = createValidComprador();
    (comprador as any).tipoIdentificacion = '99';
    const errors = await validate(comprador);
    expect(errors.some((e) => e.property === 'tipoIdentificacion')).toBe(true);
  });

  it('Sin identificacion debe fallar', async () => {
    const comprador = createValidComprador();
    comprador.identificacion = '';
    const errors = await validate(comprador);
    expect(errors.some((e) => e.property === 'identificacion')).toBe(true);
  });
});

describe('PagoDto — Validación', () => {
  it('PagoDto válido pasa validación', async () => {
    const pago = plainToInstance(PagoDto, {
      formaPago: FormaPago.SIN_UTILIZACION_SISTEMA_FINANCIERO,
      total: 100,
    });
    const errors = await validate(pago);
    expect(errors).toHaveLength(0);
  });

  it('total negativo debe fallar', async () => {
    const pago = plainToInstance(PagoDto, {
      formaPago: FormaPago.SIN_UTILIZACION_SISTEMA_FINANCIERO,
      total: -50,
    });
    const errors = await validate(pago);
    expect(errors.some((e) => e.property === 'total')).toBe(true);
  });
});

describe('CampoAdicionalDto — Validación', () => {
  it('CampoAdicionalDto válido pasa validación', async () => {
    const campo = plainToInstance(CampoAdicionalDto, {
      nombre: 'Observación',
      valor: 'Test',
    });
    const errors = await validate(campo);
    expect(errors).toHaveLength(0);
  });

  it('Sin nombre debe fallar', async () => {
    const campo = plainToInstance(CampoAdicionalDto, {
      nombre: '',
      valor: 'Test',
    });
    const errors = await validate(campo);
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });
});
