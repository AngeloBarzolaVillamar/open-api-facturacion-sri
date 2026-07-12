import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FacturaService } from './factura.service';
import { ClaveAccesoService } from './clave-acceso.service';
import { XmlBuilderService } from './xml-builder.service';
import { XmlSignerService } from './xml-signer.service';
import { SriSoapClient } from './sri-soap.client';
import { SriRepositoryService } from './sri-repository.service';
import { XmlStorageService } from './xml-storage.service';
import { SriBaseService } from './sri-base.service';
import { CreateFacturaDto } from '../dto';
import { TipoIdentificacion, FormaPago, Ambiente, TipoEmision } from '../constants';

/**
 * Tests unitarios para FacturaService.emitirFactura
 * Cubre el patrón de 3 fases: reservar secuencial → procesar SRI → persistir resultado
 */
describe('FacturaService — Emisión', () => {
  let service: FacturaService;
  let claveAccesoService: jest.Mocked<ClaveAccesoService>;
  let xmlBuilderService: jest.Mocked<XmlBuilderService>;
  let xmlSignerService: jest.Mocked<XmlSignerService>;
  let sriSoapClient: jest.Mocked<SriSoapClient>;
  let repository: jest.Mocked<SriRepositoryService>;
  let xmlStorage: jest.Mocked<XmlStorageService>;
  let base: jest.Mocked<SriBaseService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockEmisor = {
    id: 'emisor-uuid-1',
    tenant_id: 'tenant-1',
    ruc: '0924383631001',
    razon_social: 'Empresa Test S.A.',
    estado: 'ACTIVO',
    ambiente: 1,
    certificado_nombre: 'cert.p12',
    certificado_password_encrypted: 'encrypted-pass',
  };

  const mockPuntoEmision = {
    punto_emision_id: 'pe-uuid-1',
    establecimiento_id: 'est-uuid-1',
    codigo: '001',
    descripcion: 'Punto de venta 1',
    activo: true,
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
    } as any as CreateFacturaDto;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FacturaService,
        {
          provide: ClaveAccesoService,
          useValue: {
            generate: jest.fn().mockReturnValue('0702202601092438363100110010010000000161245294013'),
          },
        },
        {
          provide: XmlBuilderService,
          useValue: {
            buildFactura: jest.fn().mockReturnValue('<factura>xml</factura>'),
          },
        },
        {
          provide: XmlSignerService,
          useValue: {
            signXmlForEmisor: jest.fn().mockResolvedValue('<factura>signed</factura>'),
          },
        },
        {
          provide: SriSoapClient,
          useValue: {
            enviarYAutorizar: jest.fn(),
            validarComprobante: jest.fn(),
            autorizarComprobante: jest.fn(),
          },
        },
        {
          provide: SriRepositoryService,
          useValue: {
            findEmisorByRuc: jest.fn().mockResolvedValue(mockEmisor),
            findPuntoEmision: jest.fn().mockResolvedValue(mockPuntoEmision),
            executeInTransaction: jest.fn(),
            getNextSecuencial: jest.fn().mockResolvedValue('000000016'),
            createComprobante: jest.fn().mockResolvedValue({ id: 'comp-uuid-1' }),
            createDetalles: jest.fn().mockResolvedValue([{ id: 'det-uuid-1' }]),
            createImpuestos: jest.fn().mockResolvedValue([{ id: 'imp-uuid-1' }]),
            createTotales: jest.fn().mockResolvedValue([{ id: 'tot-uuid-1' }]),
            createPagos: jest.fn().mockResolvedValue([{ id: 'pag-uuid-1' }]),
            createInfoAdicional: jest.fn().mockResolvedValue([{ id: 'info-uuid-1' }]),
            createDetallesAdicionales: jest.fn().mockResolvedValue([{ id: 'da-uuid-1' }]),
            saveXml: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: XmlStorageService,
          useValue: {
            saveAllXmls: jest.fn().mockReturnValue({
              sinFirmaPath: undefined,
              firmadoPath: '/xmls/firmado/test.xml',
              autorizadoPath: undefined,
            }),
            saveXml: jest.fn(),
            readXml: jest.fn(),
          },
        },
        {
          provide: SriBaseService,
          useValue: {
            validarIdentificacion: jest.fn(),
            validarTipoIdentificacionCatalogo: jest.fn().mockResolvedValue(undefined),
            validarImpuestosDetalles: jest.fn().mockResolvedValue(undefined),
            validarFormasPagoCatalogo: jest.fn().mockResolvedValue(undefined),
            getDefaultAmbiente: jest.fn().mockReturnValue(Ambiente.PRUEBAS),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(FacturaService);
    claveAccesoService = module.get(ClaveAccesoService);
    xmlBuilderService = module.get(XmlBuilderService);
    xmlSignerService = module.get(XmlSignerService);
    sriSoapClient = module.get(SriSoapClient);
    repository = module.get(SriRepositoryService);
    xmlStorage = module.get(XmlStorageService);
    base = module.get(SriBaseService);
    eventEmitter = module.get(EventEmitter2);
  });

  // ==========================================
  // U-FAC-01: Emisión exitosa — SRI autoriza
  // ==========================================
  it('U-FAC-01: Emisión exitosa retorna FacturaResponseDto con success=true', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      xmlAutorizado: '<factura>autorizado</factura>',
      mensajes: [],
    });

    const result = await service.emitirFactura(createValidDto());

    expect(result.success).toBe(true);
    expect(result.estado).toBe('AUTORIZADO');
    expect(result.claveAcceso).toHaveLength(49);
    expect(result.fechaAutorizacion).toBeDefined();
    expect(result.numeroAutorizacion).toBeDefined();
  });

  // ==========================================
  // U-FAC-02: SRI devuelve comprobante (DEVUELTA)
  // ==========================================
  it('U-FAC-02: SRI devuelve comprobante → estado=DEVUELTA y emite evento rechazado', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: false,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'DEVUELTA',
      mensajes: [{ identificador: 'ERROR_1', mensaje: 'Campo inválido', tipo: 'ERROR' }],
    });

    const result = await service.emitirFactura(createValidDto());

    expect(result.success).toBe(false);
    expect(result.estado).toBe('DEVUELTA');
    expect(result.mensajes).toHaveLength(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'comprobante.rechazado',
      expect.objectContaining({ estado: 'DEVUELTA' }),
    );
  });

  // ==========================================
  // U-FAC-03: SRI rechaza comprobante (RECHAZADO)
  // ==========================================
  it('U-FAC-03: SRI rechaza → estado=RECHAZADO y emite evento rechazado', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: false,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'RECHAZADO',
      mensajes: [{ identificador: 'ERROR_2', mensaje: 'Firma inválida', tipo: 'ERROR' }],
    });

    const result = await service.emitirFactura(createValidDto());

    expect(result.success).toBe(false);
    expect(result.estado).toBe('RECHAZADO');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'comprobante.rechazado',
      expect.objectContaining({ estado: 'RECHAZADO' }),
    );
  });

  // ==========================================
  // U-FAC-04: SRI timeout → persiste como PENDIENTE y relanza error
  // ==========================================
  it('U-FAC-04: SRI timeout → persiste PENDIENTE y relanza error', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockRejectedValue(new Error('SRI timeout'));

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow('SRI timeout');

    // Debe haber persistido como PENDIENTE (executeInTransaction llamado 2 veces: secuencial + persistencia)
    expect(repository.executeInTransaction).toHaveBeenCalledTimes(2);
  });

  // ==========================================
  // U-FAC-05: Emisor no encontrado
  // ==========================================
  it('U-FAC-05: Emisor no encontrado → lanza BadRequestException', async () => {
    repository.findEmisorByRuc.mockResolvedValue(null as any);

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow();
  });

  // ==========================================
  // U-FAC-06: Emisor sin certificado digital
  // ==========================================
  it('U-FAC-06: Emisor sin certificado → lanza BadRequestException', async () => {
    repository.findEmisorByRuc.mockResolvedValue({
      ...mockEmisor,
      certificado_nombre: null,
      certificado_password_encrypted: null,
    } as any);

    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-07: Punto de emisión no encontrado
  // ==========================================
  it('U-FAC-07: Punto de emisión no encontrado → lanza BadRequestException', async () => {
    repository.findPuntoEmision.mockResolvedValue(null as any);

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-08: Secuencial manual se respeta
  // ==========================================
  it('U-FAC-08: Secuencial manual se respeta y no consulta BD', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    const dto = createValidDto();
    dto.secuencial = '000000123';

    await service.emitirFactura(dto);

    // No debe llamar getNextSecuencial ni executeInTransaction para reservar
    expect(repository.getNextSecuencial).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-FAC-09: Validación de identificación falla
  // ==========================================
  it('U-FAC-09: Identificación inválida → lanza error antes de buscar emisor', async () => {
    base.validarIdentificacion.mockImplementation(() => {
      throw new BadRequestException('Cédula inválida');
    });

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow(BadRequestException);
    expect(repository.findEmisorByRuc).not.toHaveBeenCalled();
  });

  // ==========================================
  // U-FAC-10: Validación de impuestos falla
  // ==========================================
  it('U-FAC-10: Impuestos inválidos → lanza error', async () => {
    base.validarImpuestosDetalles.mockRejectedValue(new BadRequestException('Código de impuesto inválido'));

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-11: Validación de formas de pago falla
  // ==========================================
  it('U-FAC-11: Forma de pago inválida → lanza error', async () => {
    base.validarFormasPagoCatalogo.mockRejectedValue(new BadRequestException('Forma de pago no existe en catálogo'));

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-12: Clave de acceso generada correctamente
  // ==========================================
  it('U-FAC-12: Clave de acceso se genera con datos correctos', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    await service.emitirFactura(createValidDto());

    expect(claveAccesoService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoComprobante: '01',
        ruc: '0924383631001',
        establecimiento: '001',
        puntoEmision: '001',
      }),
    );
  });

  // ==========================================
  // U-FAC-13: XML se construye y firma
  // ==========================================
  it('U-FAC-13: XML se construye y se firma con certificado del emisor', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    await service.emitirFactura(createValidDto());

    expect(xmlBuilderService.buildFactura).toHaveBeenCalledTimes(1);
    expect(xmlSignerService.signXmlForEmisor).toHaveBeenCalledWith(
      expect.any(String),
      '0924383631001',
    );
  });

  // ==========================================
  // U-FAC-14: Evento comprobante.autorizado emitido
  // ==========================================
  it('U-FAC-14: Autorización exitosa emite evento comprobante.autorizado', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    await service.emitirFactura(createValidDto());

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'comprobante.autorizado',
      expect.objectContaining({
        tipoComprobante: '01',
        claveAcceso: expect.any(String),
      }),
    );
  });

  // ==========================================
  // U-FAC-15: Descuento > subtotal lanza error
  // ==========================================
  it('U-FAC-15: Descuento mayor al subtotal del detalle → lanza BadRequestException', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));

    const dto = createValidDto();
    dto.detalles[0].descuento = 500; // subtotal = 2*100 = 200, descuento 500 > 200

    await expect(service.emitirFactura(dto)).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-16: generarXmlPreview sin secuencial
  // ==========================================
  it('U-FAC-16: generarXmlPreview sin secuencial → lanza BadRequestException', () => {
    const dto = createValidDto();
    delete dto.secuencial;

    expect(() => service.generarXmlPreview(dto)).toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-17: generarXmlPreview con secuencial válido
  // ==========================================
  it('U-FAC-17: generarXmlPreview genera XML correctamente', () => {
    const dto = createValidDto();
    dto.secuencial = '000000001';

    const xml = service.generarXmlPreview(dto);

    expect(xml).toBeDefined();
    expect(xmlBuilderService.buildFactura).toHaveBeenCalled();
    expect(claveAccesoService.generate).toHaveBeenCalled();
  });

  // ==========================================
  // U-FAC-18: generarFacturaFirmadaDebug sin secuencial
  // ==========================================
  it('U-FAC-18: generarFacturaFirmadaDebug sin secuencial → lanza BadRequestException', async () => {
    const dto = createValidDto();
    delete dto.secuencial;

    await expect(service.generarFacturaFirmadaDebug(dto)).rejects.toThrow(BadRequestException);
  });

  // ==========================================
  // U-FAC-19: generarFacturaFirmadaDebug genera XML firmado
  // ==========================================
  it('U-FAC-19: generarFacturaFirmadaDebug retorna XML sin firma y firmado', async () => {
    const dto = createValidDto();
    dto.secuencial = '000000001';

    const result = await service.generarFacturaFirmadaDebug(dto);

    expect(result.claveAcceso).toHaveLength(49);
    expect(result.xmlSinFirma).toBeDefined();
    expect(result.xmlFirmado).toBeDefined();
    expect(xmlSignerService.signXmlForEmisor).toHaveBeenCalled();
  });

  // ==========================================
  // U-FAC-20: mapResultToResponse mapea correctamente
  // ==========================================
  it('U-FAC-20: mapResultToResponse mapea todos los campos', () => {
    const result = {
      success: true,
      claveAcceso: '1234567890123456789012345678901234567890123456789',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: 'AUTH-001',
      xmlAutorizado: '<xml/>',
      mensajes: [{ identificador: 'INFO', mensaje: 'OK', tipo: 'INFORMATIVO' }],
    };

    const response = (service as any).mapResultToResponse(result);

    expect(response.success).toBe(true);
    expect(response.claveAcceso).toBe(result.claveAcceso);
    expect(response.estado).toBe('AUTORIZADO');
    expect(response.fechaAutorizacion).toBe(result.fechaAutorizacion);
    expect(response.numeroAutorizacion).toBe('AUTH-001');
    expect(response.xmlAutorizado).toBe('<xml/>');
    expect(response.mensajes).toHaveLength(1);
  });

  // ==========================================
  // U-FAC-21: Persistencia fallida emite evento persistencia_fallida
  // ==========================================
  it('U-FAC-21: Falla en persistencia post-autorización emite comprobante.persistencia_fallida', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => {
      // First call (secuencial) succeeds, second call (persist) fails
      if (repository.executeInTransaction.mock.calls.length === 1) {
        return fn({} as any);
      }
      return fn({} as any);
    });
    repository.createComprobante.mockRejectedValue(new Error('DB connection lost'));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    await expect(service.emitirFactura(createValidDto())).rejects.toThrow('DB connection lost');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'comprobante.persistencia_fallida',
      expect.objectContaining({
        claveAcceso: expect.any(String),
        error: 'DB connection lost',
      }),
    );
  });

  // ==========================================
  // U-FAC-22: Ambiente por defecto cuando no se especifica
  // ==========================================
  it('U-FAC-22: Usa ambiente por defecto (PRUEBAS) cuando dto no lo especifica', async () => {
    repository.executeInTransaction.mockImplementation(async (fn: any) => fn({} as any));
    sriSoapClient.enviarYAutorizar.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    });

    const dto = createValidDto();
    delete (dto as any).ambiente;

    await service.emitirFactura(dto);

    expect(base.getDefaultAmbiente).toHaveBeenCalled();
    expect(claveAccesoService.generate).toHaveBeenCalledWith(
      expect.objectContaining({ ambiente: Ambiente.PRUEBAS }),
    );
  });
});
