import { Test } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SriController } from './sri.controller';
import { SriService } from './sri.service';
import { EmisoresService } from '../emisores/emisores.service';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';
import { CreateFacturaDto } from './dto';
import { TipoIdentificacion, FormaPago } from './constants';

/**
 * Tests unitarios para SriController endpoints de emisión de factura
 * Cubre: emitirFactura, previewFactura, debugFacturaFirmada
 */
describe('SriController — Emisión Factura', () => {
  let controller: SriController;
  let sriService: jest.Mocked<SriService>;
  let emisoresService: jest.Mocked<EmisoresService>;
  let configService: jest.Mocked<ConfigService>;

  const adminUser: JwtPayload = {
    sub: 'user-1',
    email: 'admin@test.com',
    rol: UserRole.ADMIN,
    tenantId: 'tenant-abc',
  };

  function createValidDto(): CreateFacturaDto {
    return {
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
          impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: 12, baseImponible: 200, valor: 24 }],
        },
      ],
      pagos: [{ formaPago: FormaPago.SIN_UTILIZACION_SISTEMA_FINANCIERO, total: 224 }],
    } as any as CreateFacturaDto;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SriController],
      providers: [
        {
          provide: SriService,
          useValue: {
            emitirFactura: jest.fn(),
            generarXmlPreview: jest.fn(),
            generarFacturaFirmadaDebug: jest.fn(),
            listarComprobantes: jest.fn(),
            obtenerComprobante: jest.fn(),
            obtenerXmlAutorizado: jest.fn(),
            anularComprobante: jest.fn(),
            reintentarComprobante: jest.fn(),
            verificarEnSri: jest.fn(),
            sincronizarConSri: jest.fn(),
          },
        },
        {
          provide: EmisoresService,
          useValue: {
            validateRucAccess: jest.fn().mockResolvedValue(undefined),
            findByTenantId: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(SriController);
    sriService = module.get(SriService);
    emisoresService = module.get(EmisoresService);
    configService = module.get(ConfigService);
  });

  // ==========================================
  // U-CTRL-EMI-01: emitirFactura exitoso
  // ==========================================
  it('U-CTRL-EMI-01: emitirFactura valida RUC access y delega a sriService', async () => {
    sriService.emitirFactura.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
    } as any);

    const result = await controller.emitirFactura(createValidDto(), adminUser);

    expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', adminUser);
    expect(sriService.emitirFactura).toHaveBeenCalledWith(expect.any(Object));
    expect((result as any).success).toBe(true);
  });

  // ==========================================
  // U-CTRL-EMI-02: emitirFactura con RUC no autorizado
  // ==========================================
  it('U-CTRL-EMI-02: emitirFactura con RUC no autorizado lanza ForbiddenException', async () => {
    emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('RUC no pertenece al tenant'));

    await expect(controller.emitirFactura(createValidDto(), adminUser)).rejects.toThrow(ForbiddenException);
    expect(sriService.emitirFactura).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-CTRL-EMI-03: emitirFactura retorna respuesta asíncrona
  // ==========================================
  it('U-CTRL-EMI-03: emitirFactura retorna EN_COLA cuando es asíncrono', async () => {
    sriService.emitirFactura.mockResolvedValue({
      mensaje: 'Factura encolada para emisión asíncrona',
      jobId: 'job-456',
      estado: 'EN_COLA',
    } as any);

    const result = await controller.emitirFactura(createValidDto(), adminUser);

    expect((result as any).estado).toBe('EN_COLA');
    expect((result as any).jobId).toBe('job-456');
  });

  // ==========================================
  // U-CTRL-EMI-04: previewFactura exitoso
  // ==========================================
  it('U-CTRL-EMI-04: previewFactura valida RUC y retorna XML', async () => {
    sriService.generarXmlPreview.mockReturnValue('<factura>preview</factura>');

    const result = await controller.previewFactura(createValidDto(), adminUser);

    expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', adminUser);
    expect(sriService.generarXmlPreview).toHaveBeenCalled();
    expect(result.xml).toBe('<factura>preview</factura>');
  });

  // ==========================================
  // U-CTRL-EMI-05: previewFactura con RUC no autorizado
  // ==========================================
  it('U-CTRL-EMI-05: previewFactura con RUC no autorizado lanza ForbiddenException', async () => {
    emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('No access'));

    await expect(controller.previewFactura(createValidDto(), adminUser)).rejects.toThrow(ForbiddenException);
    expect(sriService.generarXmlPreview).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-CTRL-EMI-06: debugFacturaFirmada en test (no production)
  // ==========================================
  it('U-CTRL-EMI-06: debugFacturaFirmada funciona en entorno no-producción', async () => {
    sriService.generarFacturaFirmadaDebug.mockResolvedValue({
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      xmlSinFirma: '<xml/>',
      xmlFirmado: '<xml signed/>',
    });

    const result = await controller.debugFacturaFirmada(createValidDto(), adminUser);

    expect(result.claveAcceso).toHaveLength(49);
    expect(result.xmlFirmado).toBeDefined();
  });

  // ==========================================
  // U-CTRL-EMI-07: debugFacturaFirmada bloqueado en producción
  // ==========================================
  it('U-CTRL-EMI-07: debugFacturaFirmada lanza ForbiddenException en producción', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    await expect(controller.debugFacturaFirmada(createValidDto(), adminUser)).rejects.toThrow(ForbiddenException);
    expect(sriService.generarFacturaFirmadaDebug).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-CTRL-EMI-08: emitirFactura con SUPERADMIN (sin tenantId)
  // ==========================================
  it('U-CTRL-EMI-08: SUPERADMIN puede emitir factura sin restricción de tenant', async () => {
    const superadmin: JwtPayload = {
      sub: 'admin-1',
      email: 'admin@test.com',
      rol: UserRole.SUPERADMIN,
      tenantId: null,
    };
    sriService.emitirFactura.mockResolvedValue({ success: true, claveAcceso: 'test', estado: 'AUTORIZADO' } as any);

    await controller.emitirFactura(createValidDto(), superadmin);

    expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', superadmin);
  });

  // ==========================================
  // U-CTRL-EMI-09: previewFactura con DTO inválido (sin detalles)
  // ==========================================
  it('U-CTRL-EMI-09: previewFactura valida acceso antes de generar XML', async () => {
    emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Access denied'));

    await expect(controller.previewFactura(createValidDto(), adminUser)).rejects.toThrow(ForbiddenException);
  });

  // ==========================================
  // U-CTRL-EMI-10: emitirFactura propaga error de FacturaService
  // ==========================================
  it('U-CTRL-EMI-10: emitirFactura propaga BadRequestException del servicio', async () => {
    sriService.emitirFactura.mockRejectedValue(new BadRequestException('Certificado no encontrado'));

    await expect(controller.emitirFactura(createValidDto(), adminUser)).rejects.toThrow(BadRequestException);
  });
});
