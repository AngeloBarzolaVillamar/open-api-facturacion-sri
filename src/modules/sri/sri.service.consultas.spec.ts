import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SriService } from './sri.service';
import { SriSoapClient } from './services';
import { SriRepositoryService } from './services/sri-repository.service';
import { XmlStorageService } from './services/xml-storage.service';
import { XmlBuilderService } from './services';

describe('SriService — Consultas', () => {
  let service: SriService;
  let repository: jest.Mocked<SriRepositoryService>;
  let sriSoapClient: jest.Mocked<SriSoapClient>;
  let xmlStorage: jest.Mocked<XmlStorageService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SriService,
        {
          provide: SriSoapClient,
          useValue: {
            autorizarComprobante: jest.fn(),
            enviarYAutorizar: jest.fn(),
            validarComprobante: jest.fn(),
          },
        },
        {
          provide: SriRepositoryService,
          useValue: {
            findComprobantes: jest.fn(),
            findComprobanteConDetalles: jest.fn(),
            findComprobanteByClaveAcceso: jest.fn(),
            findDetallesByComprobanteId: jest.fn(),
            findInfoAdicionalByComprobanteId: jest.fn(),
            findXmlAutorizado: jest.fn(),
            findXmlByComprobanteId: jest.fn(),
            updateComprobante: jest.fn(),
            saveXml: jest.fn(),
          },
        },
        {
          provide: XmlStorageService,
          useValue: {
            readXml: jest.fn(),
            saveXml: jest.fn(),
          },
        },
        {
          provide: XmlBuilderService,
          useValue: {
            parseXml: jest.fn(),
            buildFactura: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'SRI_EMISION_ASYNC') return 'true';
              if (key === 'SRI_SYNC_MAX_LIMIT') return 500;
              if (key === 'SRI_REQUEST_DELAY_MS') return 0;
              if (key === 'NODE_ENV') return 'test';
              return defaultValue;
            }),
          },
        },
        {
          provide: 'BullQueue_sri-emision',
          useValue: { add: jest.fn() },
        },
        {
          provide: FacturaService,
          useValue: {},
        },
        {
          provide: NotaCreditoService,
          useValue: {},
        },
        {
          provide: NotaDebitoService,
          useValue: {},
        },
        {
          provide: RetencionService,
          useValue: {},
        },
        {
          provide: GuiaRemisionService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(SriService);
    repository = module.get(SriRepositoryService);
    sriSoapClient = module.get(SriSoapClient);
    xmlStorage = module.get(XmlStorageService);
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);
  });

  // ==========================================
  // listarComprobantes
  // ==========================================
  describe('listarComprobantes()', () => {
    const mockRows = Array.from({ length: 15 }, (_, i) => ({
      id: `comp-${i + 1}`,
      emisor_id: 'emisor-1',
      clave_acceso: `0702202601092438363100110010010000000161245294${String(i + 1).padStart(2, '0')}`,
      tipo_comprobante: '01',
      ambiente: 1,
      fecha_emision: '2026-02-07',
      establecimiento: '001',
      punto_emision: '001',
      secuencial: String(i + 1).padStart(9, '0'),
      ruc_emisor: '0924383631001',
      razon_social_emisor: 'Test Emisor',
      identificacion_comprador: '1701234567',
      razon_social_comprador: 'Test Comprador',
      subtotal: '100.00',
      total_impuestos: '15.00',
      total: '115.00',
      estado: 'AUTORIZADO',
      fecha_autorizacion: '2026-02-07T12:00:00Z',
      num_autorizacion: `AUTH-${i + 1}`,
      created_at: new Date(`2026-02-0${i + 1 < 10 ? i + 1 : 1}`),
      updated_at: new Date(),
    }));

    it('U-LIST-01: sin filtros, page=1, limit=20 retorna data con meta', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 15),
        total: 15,
      });

      const result = await service.listarComprobantes({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(15);
      expect(result.meta.total).toBe(15);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.hasMore).toBe(false);
    });

    it('U-LIST-02: filtro por rucEmisor pasa el filtro al repositorio', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 5),
        total: 5,
      });

      const result = await service.listarComprobantes({
        rucEmisor: '0924383631001',
        page: 1,
        limit: 20,
      });

      expect(repository.findComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({ rucEmisor: '0924383631001' }),
      );
      expect(result.data).toHaveLength(5);
    });

    it('U-LIST-03: filtro por estado=AUTORIZADO', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 10),
        total: 10,
      });

      const result = await service.listarComprobantes({
        estado: 'AUTORIZADO',
        page: 1,
        limit: 20,
      });

      expect(repository.findComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'AUTORIZADO' }),
      );
      expect(result.data.every((c) => c.estado === 'AUTORIZADO')).toBe(true);
    });

    it('U-LIST-04: filtro por tipoComprobante=01 (factura)', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 8),
        total: 8,
      });

      await service.listarComprobantes({
        tipoComprobante: '01',
        page: 1,
        limit: 20,
      });

      expect(repository.findComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({ tipoComprobante: '01' }),
      );
    });

    it('U-LIST-05: filtro fechaDesde/fechaHasta', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 3),
        total: 3,
      });

      await service.listarComprobantes({
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-02-28',
        page: 1,
        limit: 20,
      });

      expect(repository.findComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({
          fechaDesde: '2026-01-01',
          fechaHasta: '2026-02-28',
        }),
      );
    });

    it('U-LIST-06: filtros combinados', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(0, 2),
        total: 2,
      });

      await service.listarComprobantes({
        rucEmisor: '0924383631001',
        estado: 'AUTORIZADO',
        tipoComprobante: '01',
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-02-28',
        page: 1,
        limit: 20,
      });

      expect(repository.findComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({
          rucEmisor: '0924383631001',
          estado: 'AUTORIZADO',
          tipoComprobante: '01',
          fechaDesde: '2026-01-01',
          fechaHasta: '2026-02-28',
        }),
      );
    });

    it('U-LIST-07: paginación con cursor no retorna meta.total', async () => {
      const cursorData = Buffer.from(
        JSON.stringify({ createdAt: mockRows[9].created_at, id: mockRows[9].id }),
      ).toString('base64');

      repository.findComprobantes.mockResolvedValue({
        data: mockRows.slice(10, 15),
        total: 15,
      });

      const result = await service.listarComprobantes({
        cursor: cursorData,
        limit: 10,
      });

      expect(result.meta.total).toBeUndefined();
      expect(result.meta.totalPages).toBeUndefined();
    });

    it('U-LIST-08: sin resultados retorna data vacía', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.listarComprobantes({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('U-LIST-09: hasMore=true con nextCursor cuando hay más resultados', async () => {
      const extraRows = [...mockRows, ...mockRows.slice(0, 6).map((r, i) => ({
        ...r,
        id: `comp-extra-${i}`,
        created_at: new Date(`2026-03-0${i + 1}`),
      }))];
      repository.findComprobantes.mockResolvedValue({
        data: extraRows.slice(0, 21),
        total: 21,
      });

      const result = await service.listarComprobantes({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('U-LIST-10: mapea campos de BD (snake_case) a respuesta (camelCase)', async () => {
      repository.findComprobantes.mockResolvedValue({
        data: [mockRows[0]],
        total: 1,
      });

      const result = await service.listarComprobantes({ page: 1, limit: 20 });

      const item = result.data[0];
      expect(item.claveAcceso).toBe(mockRows[0].clave_acceso);
      expect(item.rucEmisor).toBe(mockRows[0].ruc_emisor);
      expect(item.razonSocialEmisor).toBe(mockRows[0].razon_social_emisor);
      expect(item.identificacionComprador).toBe(mockRows[0].identificacion_comprador);
      expect(item.subtotal).toBe(100);
      expect(item.totalImpuestos).toBe(15);
      expect(item.total).toBe(115);
      expect(item.tipoComprobanteDescripcion).toBeDefined();
    });
  });

  // ==========================================
  // obtenerComprobante
  // ==========================================
  describe('obtenerComprobante()', () => {
    const mockComprobante = {
      id: 'comp-1',
      clave_acceso: '0702202601092438363100110010010000000161245294013',
      tipo_comprobante: '01',
      ambiente: 1,
      fecha_emision: '2026-02-07',
      establecimiento: '001',
      punto_emision: '001',
      secuencial: '000000001',
      ruc_emisor: '0924383631001',
      razon_social_emisor: 'Test Emisor',
      identificacion_comprador: '1701234567',
      razon_social_comprador: 'Test Comprador',
      subtotal: '100.00',
      total_impuestos: '15.00',
      total: '115.00',
      estado: 'AUTORIZADO',
      fecha_autorizacion: '2026-02-07T12:00:00Z',
      num_autorizacion: 'AUTH-1',
      created_at: new Date(),
      updated_at: new Date(),
      xml_disponible: true,
    };

    const mockDetalles = [
      {
        id: 'det-1',
        codigo_principal: 'PROD001',
        descripcion: 'Producto Test',
        cantidad: '2',
        precio_unitario: '50.00',
        descuento: '0',
        subtotal: '100.00',
      },
    ];

    const mockInfoAdicional = [
      { nombre: 'Email', valor: 'test@test.com' },
    ];

    it('U-DET-01: clave existente retorna objeto con detalles e infoAdicional', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue(mockComprobante);
      repository.findDetallesByComprobanteId.mockResolvedValue(mockDetalles);
      repository.findInfoAdicionalByComprobanteId.mockResolvedValue(mockInfoAdicional);

      const result = await service.obtenerComprobante(mockComprobante.clave_acceso);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('comp-1');
      expect(result!.claveAcceso).toBe(mockComprobante.clave_acceso);
      expect(result!.detalles).toHaveLength(1);
      expect(result!.detalles[0].codigoPrincipal).toBe('PROD001');
      expect(result!.detalles[0].cantidad).toBe(2);
      expect(result!.infoAdicional).toEqual(mockInfoAdicional);
      expect(result!.xmlDisponible).toBe(true);
    });

    it('U-DET-02: clave inexistente retorna null', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue(null);

      const result = await service.obtenerComprobante('no-existe-clave-49-digitos-1234567890123');

      expect(result).toBeNull();
    });

    it('U-DET-03: detalles con impuestos mapeados correctamente', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue(mockComprobante);
      repository.findDetallesByComprobanteId.mockResolvedValue([
        {
          id: 'det-1',
          codigo_principal: 'PROD001',
          descripcion: 'Producto A',
          cantidad: '3',
          precio_unitario: '33.33',
          descuento: '10',
          subtotal: '89.99',
        },
        {
          id: 'det-2',
          codigo_principal: 'PROD002',
          descripcion: 'Producto B',
          cantidad: '1',
          precio_unitario: '100',
          descuento: '0',
          subtotal: '100',
        },
      ]);
      repository.findInfoAdicionalByComprobanteId.mockResolvedValue([]);

      const result = await service.obtenerComprobante(mockComprobante.clave_acceso);

      expect(result!.detalles).toHaveLength(2);
      expect(result!.detalles[0].cantidad).toBe(3);
      expect(result!.detalles[0].precioUnitario).toBeCloseTo(33.33, 2);
      expect(result!.detalles[0].descuento).toBe(10);
    });

    it('U-DET-04: sin infoAdicional retorna array vacío', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue(mockComprobante);
      repository.findDetallesByComprobanteId.mockResolvedValue(mockDetalles);
      repository.findInfoAdicionalByComprobanteId.mockResolvedValue([]);

      const result = await service.obtenerComprobante(mockComprobante.clave_acceso);

      expect(result!.infoAdicional).toEqual([]);
    });

    it('U-DET-05: xmlDisponible=true cuando tiene XML autorizado', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue({
        ...mockComprobante,
        xml_disponible: true,
      });
      repository.findDetallesByComprobanteId.mockResolvedValue(mockDetalles);
      repository.findInfoAdicionalByComprobanteId.mockResolvedValue([]);

      const result = await service.obtenerComprobante(mockComprobante.clave_acceso);

      expect(result!.xmlDisponible).toBe(true);
    });

    it('U-DET-06: xmlDisponible=false cuando es pendiente', async () => {
      repository.findComprobanteConDetalles.mockResolvedValue({
        ...mockComprobante,
        estado: 'PENDIENTE',
        xml_disponible: false,
      });
      repository.findDetallesByComprobanteId.mockResolvedValue(mockDetalles);
      repository.findInfoAdicionalByComprobanteId.mockResolvedValue([]);

      const result = await service.obtenerComprobante(mockComprobante.clave_acceso);

      expect(result!.xmlDisponible).toBe(false);
    });
  });

  // ==========================================
  // obtenerXmlAutorizado
  // ==========================================
  describe('obtenerXmlAutorizado()', () => {
    it('U-XML-01: XML disponible retorna string con contenido', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'AUTORIZADO' } as any);
      repository.findXmlAutorizado.mockResolvedValue('/path/to/xml.xml' as any);
      xmlStorage.readXml.mockReturnValue('<?xml version="1.0"?>...');

      const result = await service.obtenerXmlAutorizado('0702202601092438363100110010010000000161245294013');

      expect(result).not.toBeNull();
      expect(result).toContain('<?xml');
    });

    it('U-XML-02: XML no disponible retorna null', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'PENDIENTE' } as any);
      repository.findXmlAutorizado.mockResolvedValue(null as any);

      const result = await service.obtenerXmlAutorizado('0702202601092438363100110010010000000161245294013');

      expect(result).toBeNull();
    });

    it('U-XML-03: comprobante no existe retorna null', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(null as any);

      const result = await service.obtenerXmlAutorizado('0702202601092438363100110010010000000161245294013');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // anularComprobante
  // ==========================================
  describe('anularComprobante()', () => {
    it('U-ANU-01: anular PENDIENTE cambia estado a ANULADO', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        id: 'comp-1',
        estado: 'PENDIENTE',
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);

      const result = await service.anularComprobante('0702202601092438363100110010010000000161245294013');

      expect(result.message).toContain('anulado');
      expect(result.estadoAnterior).toBe('PENDIENTE');
      expect(repository.updateComprobante).toHaveBeenCalledWith('comp-1', {
        estado: 'ANULADO',
        estado_sri: 'ANULADO',
      });
    });

    it('U-ANU-02: anular DEVUELTA cambia estado a ANULADO', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        id: 'comp-1',
        estado: 'DEVUELTA',
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);

      const result = await service.anularComprobante('0702202601092438363100110010010000000161245294013');

      expect(result.estadoAnterior).toBe('DEVUELTA');
    });

    it('U-ANU-03: anular AUTORIZADO lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        id: 'comp-1',
        estado: 'AUTORIZADO',
      } as any);

      await expect(
        service.anularComprobante('0702202601092438363100110010010000000161245294013'),
      ).rejects.toThrow(BadRequestException);
    });

    it('U-ANU-04: anular ya ANULADO lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        id: 'comp-1',
        estado: 'ANULADO',
      } as any);

      await expect(
        service.anularComprobante('0702202601092438363100110010010000000161245294013'),
      ).rejects.toThrow(BadRequestException);
    });

    it('U-ANU-05: clave inexistente lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(null as any);

      await expect(
        service.anularComprobante('0702202601092438363100110010010000000161245294013'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // reintentarComprobante
  // ==========================================
  describe('reintentarComprobante()', () => {
    const claveAcceso = '0702202601092438363100110010010000000161245294013';
    const mockComp = {
      id: 'comp-1',
      estado: 'DEVUELTA',
      fecha_emision: '2026-02-07',
    };

    it('U-REI-01: reintentar DEVUELTA exitoso — SRI autoriza', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(mockComp as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: '/path/to/firmado.xml',
      } as any);
      xmlStorage.readXml.mockReturnValue('<?xml version="1.0"?><factura>...</factura>');
      sriSoapClient.enviarYAutorizar.mockResolvedValue({
        success: true,
        estado: 'AUTORIZADO',
        claveAcceso,
        fechaAutorizacion: '2026-02-07T15:00:00Z',
        numeroAutorizacion: 'AUTH-NEW',
        xmlAutorizado: '<?xml version="1.0"?><factura>autorizado</factura>',
        mensajes: [],
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);
      xmlStorage.saveXml.mockReturnValue('/path/to/autorizado.xml');
      repository.saveXml.mockResolvedValue(undefined as any);

      const result = await service.reintentarComprobante(claveAcceso);

      expect(result.estado).toBe('AUTORIZADO');
      expect(result.fechaAutorizacion).toBe('2026-02-07T15:00:00Z');
      expect(result.mensaje).toContain('autorizado');
      expect(repository.updateComprobante).toHaveBeenCalledWith('comp-1', expect.objectContaining({
        estado: 'AUTORIZADO',
      }));
    });

    it('U-REI-02: reintentar RECHAZADO — reenvío al SRI', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        ...mockComp,
        estado: 'RECHAZADO',
      } as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: '/path/to/firmado.xml',
      } as any);
      xmlStorage.readXml.mockReturnValue('<?xml version="1.0"?>...');
      sriSoapClient.enviarYAutorizar.mockResolvedValue({
        success: false,
        estado: 'RECHAZADO',
        claveAcceso,
        mensajes: [{ tipo: 'ERROR', identificador: 'ERR-1', mensaje: 'Error test' }],
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);

      const result = await service.reintentarComprobante(claveAcceso);

      expect(result.estado).toBe('RECHAZADO');
      expect(result.errores).toBeDefined();
      expect(result.errores!.length).toBeGreaterThan(0);
    });

    it('U-REI-03: reintentar AUTORIZADO lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        ...mockComp,
        estado: 'AUTORIZADO',
      } as any);

      await expect(service.reintentarComprobante(claveAcceso)).rejects.toThrow(BadRequestException);
    });

    it('U-REI-04: sin XML firmado lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(mockComp as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: null,
      } as any);

      await expect(service.reintentarComprobante(claveAcceso)).rejects.toThrow(BadRequestException);
    });

    it('U-REI-05: XML firmado no encontrado en filesystem lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(mockComp as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: '/path/to/firmado.xml',
      } as any);
      xmlStorage.readXml.mockReturnValue(null as unknown as string);

      await expect(service.reintentarComprobante(claveAcceso)).rejects.toThrow(BadRequestException);
    });

    it('U-REI-06: errores SRI mapeados a string[]', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(mockComp as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: '/path/to/firmado.xml',
      } as any);
      xmlStorage.readXml.mockReturnValue('<?xml version="1.0"?>...');
      sriSoapClient.enviarYAutorizar.mockResolvedValue({
        success: false,
        estado: 'DEVUELTA',
        claveAcceso,
        mensajes: [
          { tipo: 'ERROR', identificador: 'ERR-01', mensaje: 'Error 1' },
          { tipo: 'ADVERTENCIA', identificador: 'WARN-01', mensaje: 'Warning 1', informacionAdicional: 'Extra info' },
        ],
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);

      const result = await service.reintentarComprobante(claveAcceso);

      expect(result.errores).toBeDefined();
      expect(result.errores).toHaveLength(2);
      expect(result.errores![0]).toContain('ERR-01');
      expect(result.errores![0]).toContain('Error 1');
      expect(result.errores![1]).toContain('Extra info');
    });

    it('U-REI-07: comprobante no existe lanza BadRequestException', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue(null as any);

      await expect(service.reintentarComprobante(claveAcceso)).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // verificarEnSri
  // ==========================================
  describe('verificarEnSri()', () => {
    const claveAcceso = '0702202601092438363100110010010000000161245294013';

    it('U-VER-01: SRI autorizado retorna existeEnSri=true', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'AUTORIZADO' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'AUTORIZADO',
            fechaAutorizacion: '2026-02-07T12:00:00Z',
            numeroAutorizacion: 'AUTH-1',
            comprobante: '<factura>...</factura>',
            mensajes: { mensaje: [] },
          },
        },
      } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.existeEnSri).toBe(true);
      expect(result.estado).toBe('AUTORIZADO');
      expect(result.fechaAutorizacion).toBe('2026-02-07T12:00:00Z');
      expect(result.numeroAutorizacion).toBe('AUTH-1');
    });

    it('U-VER-02: SRI no existe retorna existeEnSri=false', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'PENDIENTE' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.existeEnSri).toBe(false);
      expect(result.estado).toBe('NO EXISTE');
    });

    it('U-VER-03: SRI devuelta con mensajes mapeados', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'DEVUELTA' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'DEVUELTA',
            mensajes: {
              mensaje: [
                { tipo: 'ERROR', identificador: 'ERR-1', mensaje: 'Error SRI' },
              ],
            },
          },
        },
      } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.estado).toBe('DEVUELTA');
      expect(result.mensajes).toBeDefined();
      expect(result.mensajes!.length).toBe(1);
      expect(result.mensajes![0]).toContain('ERR-1');
      expect(result.mensajes![0]).toContain('Error SRI');
    });

    it('U-VER-04: clave inválida (no 49 dígitos) lanza BadRequestException', async () => {
      await expect(service.verificarEnSri('123')).rejects.toThrow(BadRequestException);
    });

    it('U-VER-05: NO modifica BD local', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'PENDIENTE' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: { estado: 'AUTORIZADO', mensajes: { mensaje: [] } },
        },
      } as any);

      await service.verificarEnSri(claveAcceso);

      expect(repository.updateComprobante).not.toHaveBeenCalled();
    });

    it('U-VER-06: sincronizado=true cuando estados coinciden', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'AUTORIZADO' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: { estado: 'AUTORIZADO', mensajes: { mensaje: [] } },
        },
      } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.sincronizado).toBe(true);
    });

    it('U-VER-07: sincronizado=false cuando estados difieren', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'PENDIENTE' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: { estado: 'AUTORIZADO', mensajes: { mensaje: [] } },
        },
      } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.sincronizado).toBe(false);
      expect(result.estadoLocal).toBe('PENDIENTE');
    });

    it('U-VER-08: múltiples autorizaciones toma la primera', async () => {
      repository.findComprobanteByClaveAcceso.mockResolvedValue({ id: 'comp-1', estado: 'AUTORIZADO' } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: [
            { estado: 'AUTORIZADO', fechaAutorizacion: '2026-02-07', mensajes: { mensaje: [] } },
            { estado: 'NO AUTORIZADO', mensajes: { mensaje: [] } },
          ],
        },
      } as any);

      const result = await service.verificarEnSri(claveAcceso);

      expect(result.estado).toBe('AUTORIZADO');
    });
  });

  // ==========================================
  // sincronizarConSri
  // ==========================================
  describe('sincronizarConSri()', () => {
    const mockCompRow = (id: string, estado: string, claveAcceso: string) => ({
      id,
      emisor_id: 'emisor-1',
      clave_acceso: claveAcceso,
      tipo_comprobante: '01',
      ambiente: 1,
      fecha_emision: '2026-02-07',
      establecimiento: '001',
      punto_emision: '001',
      secuencial: '000000001',
      ruc_emisor: '0924383631001',
      razon_social_emisor: 'Test',
      identificacion_comprador: '1701234567',
      razon_social_comprador: 'Test',
      subtotal: '100.00',
      total_impuestos: '15.00',
      total: '115.00',
      estado,
      fecha_autorizacion: null,
      num_autorizacion: null,
      created_at: new Date('2026-02-07'),
      updated_at: new Date(),
    });

    it('U-SYN-01: sincronización básica retorna resumen', async () => {
      const comps = [mockCompRow('comp-1', 'PENDIENTE', '0702202601092438363100110010010000000161245294013')];
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 1 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'AUTORIZADO',
            fechaAutorizacion: '2026-02-07T12:00:00Z',
            numeroAutorizacion: 'AUTH-1',
            comprobante: '<factura>...</factura>',
            mensajes: {},
          },
        },
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);
      xmlStorage.saveXml.mockReturnValue('/path/to/autorizado.xml');
      repository.saveXml.mockResolvedValue(undefined as any);

      const result = await service.sincronizarConSri({ limite: 10 });

      expect(result.procesados).toBe(1);
      expect(result.actualizados).toBe(1);
      expect(result.errores).toBe(0);
      expect(result.detalle).toHaveLength(1);
      expect(result.detalle[0].accion).toBe('ACTUALIZADO');
    });

    it('U-SYN-02: con reintentar=true reintenta los que no existen en SRI', async () => {
      const comps = [mockCompRow('comp-1', 'PENDIENTE', '0702202601092438363100110010010000000161245294013')];
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 1 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);
      // Mock reintentarComprobante dependencies
      repository.findComprobanteByClaveAcceso.mockResolvedValue({
        id: 'comp-1',
        estado: 'PENDIENTE',
        fecha_emision: '2026-02-07',
      } as any);
      repository.findXmlByComprobanteId.mockResolvedValue({
        xml_firmado_path: '/path/to/firmado.xml',
      } as any);
      xmlStorage.readXml.mockReturnValue('<?xml version="1.0"?>...');
      sriSoapClient.enviarYAutorizar.mockResolvedValue({
        success: true,
        estado: 'AUTORIZADO',
        claveAcceso: '0702202601092438363100110010010000000161245294013',
        fechaAutorizacion: '2026-02-07T15:00:00Z',
        numeroAutorizacion: 'AUTH-NEW',
        xmlAutorizado: '<factura>...</factura>',
        mensajes: [],
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);
      xmlStorage.saveXml.mockReturnValue('/path/to/autorizado.xml');
      repository.saveXml.mockResolvedValue(undefined as any);

      const result = await service.sincronizarConSri({ reintentar: true, limite: 10 });

      expect(result.reintentados).toBe(1);
      expect(result.detalle[0].accion).toBe('REINTENTADO');
    });

    it('U-SYN-03: sin pendientes retorna procesados=0', async () => {
      repository.findComprobantes.mockResolvedValue({ data: [], total: 0 } as any);

      const result = await service.sincronizarConSri({ limite: 50 });

      expect(result.procesados).toBe(0);
      expect(result.actualizados).toBe(0);
      expect(result.detalle).toEqual([]);
    });

    it('U-SYN-04: límite respetado', async () => {
      const comps = Array.from({ length: 3 }, (_, i) =>
        mockCompRow(`comp-${i}`, 'PENDIENTE', `0702202601092438363100110010010000000161245294${String(i).padStart(2, '0')}1`),
      );
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 3 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);

      const result = await service.sincronizarConSri({ limite: 3 });

      expect(result.procesados).toBe(3);
    });

    it('U-SYN-05: batch processing en lotes de 50', async () => {
      const batch1 = Array.from({ length: 50 }, (_, i) =>
        mockCompRow(`comp-${i}`, 'PENDIENTE', `0702202601092438363100110010010000000161245294${String(i).padStart(2, '0')}1`),
      );
      const batch2 = Array.from({ length: 10 }, (_, i) =>
        mockCompRow(`comp-${i + 50}`, 'PENDIENTE', `0702202601092438363100110010010000000161245294${String(i + 50).padStart(2, '0')}1`),
      );

      repository.findComprobantes
        .mockResolvedValueOnce({ data: batch1, total: 60 } as any)
        .mockResolvedValueOnce({ data: batch2, total: 60 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);

      const result = await service.sincronizarConSri({ limite: 60 });

      expect(result.procesados).toBe(60);
      expect(repository.findComprobantes).toHaveBeenCalledTimes(2);
    });

    it('U-SYN-06: error no detiene el batch', async () => {
      const comps = [
        mockCompRow('comp-1', 'PENDIENTE', '0702202601092438363100110010010000000161245294011'),
        mockCompRow('comp-2', 'PENDIENTE', '0702202601092438363100110010010000000161245294021'),
      ];
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 2 } as any);
      sriSoapClient.autorizarComprobante
        .mockRejectedValueOnce(new Error('SRI timeout'))
        .mockResolvedValueOnce({
          autorizaciones: {
            autorizacion: { estado: 'AUTORIZADO', mensajes: { mensaje: [] }, comprobante: '<x/>', fechaAutorizacion: '2026-02-07', numeroAutorizacion: 'A1' },
          },
        } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);
      xmlStorage.saveXml.mockReturnValue('/path');
      repository.saveXml.mockResolvedValue(undefined as any);

      const result = await service.sincronizarConSri({ limite: 10 });

      expect(result.procesados).toBe(2);
      expect(result.errores).toBe(1);
      expect(result.actualizados).toBe(1);
    });

    it('U-SYN-07: evento comprobante.autorizado emitido', async () => {
      const comps = [mockCompRow('comp-1', 'PENDIENTE', '0702202601092438363100110010010000000161245294013')];
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 1 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'AUTORIZADO',
            fechaAutorizacion: '2026-02-07T12:00:00Z',
            numeroAutorizacion: 'AUTH-1',
            comprobante: '<factura>...</factura>',
            mensajes: { mensaje: [] },
          },
        },
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);
      xmlStorage.saveXml.mockReturnValue('/path');
      repository.saveXml.mockResolvedValue(undefined as any);

      await service.sincronizarConSri({ limite: 10 });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'comprobante.autorizado',
        expect.objectContaining({
          claveAcceso: '0702202601092438363100110010010000000161245294013',
          tipoComprobante: '01',
        }),
      );
    });

    it('U-SYN-08: evento comprobante.rechazado emitido para RECHAZADO', async () => {
      const comps = [mockCompRow('comp-1', 'PENDIENTE', '0702202601092438363100110010010000000161245294013')];
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 1 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'NO AUTORIZADO',
            mensajes: { mensaje: [{ tipo: 'ERROR', identificador: 'ERR', mensaje: 'Error' }] },
          },
        },
      } as any);
      repository.updateComprobante.mockResolvedValue(undefined as any);

      await service.sincronizarConSri({ limite: 10 });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'comprobante.rechazado',
        expect.objectContaining({
          claveAcceso: '0702202601092438363100110010010000000161245294013',
          estado: 'NO AUTORIZADO',
        }),
      );
    });

    it('U-SYN-09: límite máximo global respeta SRI_SYNC_MAX_LIMIT', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'SRI_SYNC_MAX_LIMIT') return 100;
        if (key === 'SRI_REQUEST_DELAY_MS') return 0;
        return defaultValue;
      });

      const comps = Array.from({ length: 50 }, (_, i) =>
        mockCompRow(`comp-${i}`, 'PENDIENTE', `0702202601092438363100110010010000000161245294${String(i).padStart(2, '0')}1`),
      );
      repository.findComprobantes.mockResolvedValue({ data: comps, total: 50 } as any);
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);

      const result = await service.sincronizarConSri({ limite: 500 });

      expect(result.procesados).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // consultarAutorizacion
  // ==========================================
  describe('consultarAutorizacion()', () => {
    const claveAcceso = '0702202601092438363100110010010000000161245294013';

    it('U-AUT-01: SRI autorizado retorna success=true', async () => {
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'AUTORIZADO',
            fechaAutorizacion: '2026-02-07T12:00:00Z',
            numeroAutorizacion: 'AUTH-1',
            comprobante: '<factura>xml</factura>',
            mensajes: { mensaje: [] },
          },
        },
      } as any);

      const result = await service.consultarAutorizacion(claveAcceso);

      expect(result.success).toBe(true);
      expect(result.estado).toBe('AUTORIZADO');
      expect(result.xmlAutorizado).toBe('<factura>xml</factura>');
    });

    it('U-AUT-02: SRI no encontrado retorna success=false', async () => {
      sriSoapClient.autorizarComprobante.mockResolvedValue({ autorizaciones: {} } as any);

      const result = await service.consultarAutorizacion(claveAcceso);

      expect(result.success).toBe(false);
      expect(result.estado).toBe('NO ENCONTRADO');
    });

    it('U-AUT-03: múltiples autorizaciones toma la primera', async () => {
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: [
            { estado: 'AUTORIZADO', fechaAutorizacion: '2026-02-07', numeroAutorizacion: 'A1', mensajes: { mensaje: [] } },
            { estado: 'NO AUTORIZADO', mensajes: { mensaje: [] } },
          ],
        },
      } as any);

      const result = await service.consultarAutorizacion(claveAcceso);

      expect(result.estado).toBe('AUTORIZADO');
      expect(result.numeroAutorizacion).toBe('A1');
    });

    it('U-AUT-04: mensajes mapeados a array', async () => {
      sriSoapClient.autorizarComprobante.mockResolvedValue({
        autorizaciones: {
          autorizacion: {
            estado: 'DEVUELTA',
            mensajes: {
              mensaje: [
                { identificador: 'ERR-1', mensaje: 'Error 1', tipo: 'ERROR' },
                { identificador: 'ERR-2', mensaje: 'Error 2', tipo: 'ADVERTENCIA' },
              ],
            },
          },
        },
      } as any);

      const result = await service.consultarAutorizacion(claveAcceso);

      expect(result.mensajes).toHaveLength(2);
      expect(result.mensajes![0].identificador).toBe('ERR-1');
    });
  });

  // ==========================================
  // validarXml
  // ==========================================
  describe('validarXml()', () => {
    it('U-VXML-01: XML válido con firma retorna valido=true', async () => {
      const xml = '<?xml version="1.0"?><factura><infoTributaria><claveAcceso>1234567890123456789012345678901234567890123456789</claveAcceso></infoTributaria><ds:Signature>...</ds:Signature></factura>';
      const xmlBuilder = service['xmlBuilder'] as any;
      xmlBuilder.parseXml.mockResolvedValue(true);

      const result = await service.validarXml(xml);

      expect(result.valido).toBe(true);
      expect(result.errores).toEqual([]);
    });

    it('U-VXML-02: XML sin firma digital retorna error', async () => {
      const xml = '<?xml version="1.0"?><factura><infoTributaria><claveAcceso>1234567890123456789012345678901234567890123456789</claveAcceso></infoTributaria></factura>';
      const xmlBuilder = service['xmlBuilder'] as any;
      xmlBuilder.parseXml.mockResolvedValue(true);

      const result = await service.validarXml(xml);

      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes('firma'))).toBe(true);
    });

    it('U-VXML-03: XML malformado retorna error de parseo', async () => {
      const xml = 'not xml at all';
      const xmlBuilder = service['xmlBuilder'] as any;
      xmlBuilder.parseXml.mockRejectedValue(new Error('Parse error'));

      const result = await service.validarXml(xml);

      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes('malformado'))).toBe(true);
    });

    it('U-VXML-04: XML sin clave de acceso de 49 dígitos retorna error', async () => {
      const xml = '<?xml version="1.0"?><factura><infoTributaria><claveAcceso>123</claveAcceso></infoTributaria><ds:Signature>...</ds:Signature></factura>';
      const xmlBuilder = service['xmlBuilder'] as any;
      xmlBuilder.parseXml.mockResolvedValue(true);

      const result = await service.validarXml(xml);

      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes('clave de acceso'))).toBe(true);
    });

    it('U-VXML-05: XML vacío retorna error', async () => {
      const result = await service.validarXml('');

      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes('vacío'))).toBe(true);
    });

    it('U-VXML-06: tipo de comprobante inválido retorna error', async () => {
      const xml = '<?xml version="1.0"?><otherDoc><infoTributaria><claveAcceso>1234567890123456789012345678901234567890123456789</claveAcceso></infoTributaria><ds:Signature>...</ds:Signature></otherDoc>';
      const xmlBuilder = service['xmlBuilder'] as any;
      xmlBuilder.parseXml.mockResolvedValue(true);

      const result = await service.validarXml(xml);

      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes('tipo de comprobante'))).toBe(true);
    });
  });
});

// Import services that are needed for the providers list
import { FacturaService } from './services/factura.service';
import { NotaCreditoService } from './services/nota-credito.service';
import { NotaDebitoService } from './services/nota-debito.service';
import { RetencionService } from './services/retencion.service';
import { GuiaRemisionService } from './services/guia-remision.service';
