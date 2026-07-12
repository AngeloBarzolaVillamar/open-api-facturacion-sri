import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SriService } from './sri.service';
import { SriSoapClient, FacturaService, NotaCreditoService, NotaDebitoService, RetencionService, GuiaRemisionService, XmlBuilderService } from './services';
import { SriRepositoryService } from './services/sri-repository.service';
import { XmlStorageService } from './services/xml-storage.service';
import { CreateFacturaDto } from './dto';
import { TipoIdentificacion, FormaPago } from './constants';

/**
 * Tests unitarios para SriService.emitirFactura
 * Cubre decisión síncrono/Asíncrono y delegación a FacturaService
 */
describe('SriService — Emisión Factura', () => {
  let service: SriService;
  let facturaService: jest.Mocked<FacturaService>;
  let emisionQueue: { add: jest.Mock };
  let configService: jest.Mocked<ConfigService>;

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
    emisionQueue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }) };

    const module = await Test.createTestingModule({
      providers: [
        SriService,
        {
          provide: SriSoapClient,
          useValue: { autorizarComprobante: jest.fn(), enviarYAutorizar: jest.fn(), validarComprobante: jest.fn() },
        },
        {
          provide: SriRepositoryService,
          useValue: { findComprobantes: jest.fn(), findComprobanteByClaveAcceso: jest.fn() },
        },
        {
          provide: XmlStorageService,
          useValue: { readXml: jest.fn(), saveXml: jest.fn() },
        },
        {
          provide: FacturaService,
          useValue: { emitirFactura: jest.fn(), generarXmlPreview: jest.fn(), generarFacturaFirmadaDebug: jest.fn() },
        },
        { provide: NotaCreditoService, useValue: {} },
        { provide: NotaDebitoService, useValue: {} },
        { provide: RetencionService, useValue: {} },
        { provide: GuiaRemisionService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'SRI_EMISION_ASYNC') return 'true';
              if (key === 'NODE_ENV') return 'test';
              return defaultValue;
            }),
          },
        },
        { provide: XmlBuilderService, useValue: { parseXml: jest.fn() } },
        { provide: 'BullQueue_sri-emision', useValue: emisionQueue },
      ],
    }).compile();

    service = module.get(SriService);
    facturaService = module.get(FacturaService);
    configService = module.get(ConfigService);
  });

  // ==========================================
  // U-SRI-EMI-01: Modo asíncrono encola job
  // ==========================================
  it('U-SRI-EMI-01: SRI_EMISION_ASYNC=true → encola job y retorna EN_COLA', async () => {
    configService.get.mockReturnValue('true');

    const result = await service.emitirFactura(createValidDto());

    expect(emisionQueue.add).toHaveBeenCalledWith('emision', expect.objectContaining({ tipo: 'FACTURA' }));
    expect(result).toEqual({
      mensaje: 'Factura encolada para emisión asíncrona',
      jobId: 'job-123',
      estado: 'EN_COLA',
    });
    expect(facturaService.emitirFactura).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-SRI-EMI-02: Modo síncrono delega a FacturaService
  // ==========================================
  it('U-SRI-EMI-02: SRI_EMISION_ASYNC=false → delega a FacturaService.emitirFactura', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'SRI_EMISION_ASYNC') return 'false';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    facturaService.emitirFactura.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
    } as any);

    const result = await service.emitirFactura(createValidDto());

    expect(facturaService.emitirFactura).toHaveBeenCalledWith(expect.any(Object));
    expect(emisionQueue.add).not.toHaveBeenCalled();
    expect((result as any).success).toBe(true);
  });

  // ==========================================
  // U-SRI-EMI-03: generarXmlPreview delega a FacturaService
  // ==========================================
  it('U-SRI-EMI-03: generarXmlPreview delega a FacturaService', () => {
    facturaService.generarXmlPreview.mockReturnValue('<factura>xml</factura>');

    const result = service.generarXmlPreview(createValidDto());

    expect(facturaService.generarXmlPreview).toHaveBeenCalled();
    expect(result).toBe('<factura>xml</factura>');
  });

  // ==========================================
  // U-SRI-EMI-04: generarFacturaFirmadaDebug delega a FacturaService
  // ==========================================
  it('U-SRI-EMI-04: generarFacturaFirmadaDebug delega a FacturaService', async () => {
    facturaService.generarFacturaFirmadaDebug.mockResolvedValue({
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      xmlSinFirma: '<xml/>',
      xmlFirmado: '<xml signed/>',
    });

    const result = await service.generarFacturaFirmadaDebug(createValidDto());

    expect(facturaService.generarFacturaFirmadaDebug).toHaveBeenCalled();
    expect(result.claveAcceso).toHaveLength(49);
    expect(result.xmlFirmado).toBeDefined();
  });
});
