import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SriController } from './sri.controller';
import { SriService } from './sri.service';
import { EmisoresService } from '../emisores/emisores.service';
import { JwtPayload, UserRole } from '../auth/dto/auth.dto';
import {
  QueryComprobantesDto,
  EstadoComprobante,
  TipoComprobanteQuery,
} from './dto/query-comprobantes.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('SriController — Consultas (Multi-tenant + DTO)', () => {
  let controller: SriController;
  let sriService: jest.Mocked<SriService>;
  let emisoresService: jest.Mocked<EmisoresService>;
  let configService: jest.Mocked<ConfigService>;

  const superadminUser: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    rol: UserRole.SUPERADMIN,
    tenantId: null,
  };

  const adminUser: JwtPayload = {
    sub: 'user-1',
    email: 'user@test.com',
    rol: UserRole.ADMIN,
    tenantId: 'tenant-abc',
  };

  const regularUser: JwtPayload = {
    sub: 'user-2',
    email: 'user2@test.com',
    rol: UserRole.USER,
    tenantId: 'tenant-xyz',
  };

  const claveAcceso = '0702202601092438363100110010010000000161245294013';
  const rucFromClave = '0924383631001';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SriController],
      providers: [
        {
          provide: SriService,
          useValue: {
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
            validateRucAccess: jest.fn(),
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
  // listarComprobantes — Multi-tenant
  // ==========================================
  describe('listarComprobantes() — Multi-tenant', () => {
    it('U-CTRL-LIST-01: SUPERADMIN sin rucEmisor pasa directo al servicio', async () => {
      const query: QueryComprobantesDto = { page: 1, limit: 20 };
      const mockResult = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      sriService.listarComprobantes.mockResolvedValue(mockResult as any);

      const result = await controller.listarComprobantes(query, superadminUser);

      expect(emisoresService.validateRucAccess).not.toHaveBeenCalled();
      expect(emisoresService.findByTenantId).not.toHaveBeenCalled();
      expect(sriService.listarComprobantes).toHaveBeenCalledWith(query);
    });

    it('U-CTRL-LIST-02: SUPERADMIN con rucEmisor pasa directo sin validación de tenant', async () => {
      const query: QueryComprobantesDto = { rucEmisor: '0924383631001', page: 1, limit: 20 };
      const mockResult = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      sriService.listarComprobantes.mockResolvedValue(mockResult as any);

      await controller.listarComprobantes(query, superadminUser);

      expect(emisoresService.validateRucAccess).not.toHaveBeenCalled();
      expect(sriService.listarComprobantes).toHaveBeenCalledWith(query);
    });

    it('U-CTRL-LIST-03: ADMIN con rucEmisor valida acceso al tenant', async () => {
      const query: QueryComprobantesDto = { rucEmisor: '0924383631001', page: 1, limit: 20 };
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);
      sriService.listarComprobantes.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } as any);

      await controller.listarComprobantes(query, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', adminUser);
      expect(sriService.listarComprobantes).toHaveBeenCalledWith(query);
    });

    it('U-CTRL-LIST-04: ADMIN sin rucEmisor filtra por emisores del tenant', async () => {
      const query: QueryComprobantesDto = { page: 1, limit: 20 };
      const mockEmisores = [{ id: 'emisor-1' }, { id: 'emisor-2' }];
      emisoresService.findByTenantId.mockResolvedValue(mockEmisores as any);
      sriService.listarComprobantes.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } as any);

      await controller.listarComprobantes(query, adminUser);

      expect(emisoresService.findByTenantId).toHaveBeenCalledWith('tenant-abc');
      expect(sriService.listarComprobantes).toHaveBeenCalledWith({
        ...query,
        emisorIds: ['emisor-1', 'emisor-2'],
      });
    });

    it('U-CTRL-LIST-05: ADMIN sin rucEmisor y sin emisores en tenant retorna vacío', async () => {
      const query: QueryComprobantesDto = { page: 1, limit: 20 };
      emisoresService.findByTenantId.mockResolvedValue([]);

      const result = await controller.listarComprobantes(query, adminUser);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(sriService.listarComprobantes).not.toHaveBeenCalled();
    });

    it('U-CTRL-LIST-06: ADMIN sin rucEmisor y tenant sin emisores (null) retorna vacío', async () => {
      const query: QueryComprobantesDto = { page: 1, limit: 20 };
      emisoresService.findByTenantId.mockResolvedValue(null as any);

      const result = await controller.listarComprobantes(query, adminUser);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('U-CTRL-LIST-07: ADMIN con rucEmisor ajeno a tenant lanza ForbiddenException', async () => {
      const query: QueryComprobantesDto = { rucEmisor: '9999999999999', page: 1, limit: 20 };
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('RUC no pertenece al tenant'));

      await expect(controller.listarComprobantes(query, adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-LIST-08: USER con rucEmisor valida acceso al tenant', async () => {
      const query: QueryComprobantesDto = { rucEmisor: '0924383631001', page: 1, limit: 10 };
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);
      sriService.listarComprobantes.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } as any);

      await controller.listarComprobantes(query, regularUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', regularUser);
    });

    it('U-CTRL-LIST-09: USER sin rucEmisor filtra por tenant', async () => {
      const query: QueryComprobantesDto = { page: 1, limit: 10 };
      emisoresService.findByTenantId.mockResolvedValue([{ id: 'emisor-x' }] as any);
      sriService.listarComprobantes.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } as any);

      await controller.listarComprobantes(query, regularUser);

      expect(emisoresService.findByTenantId).toHaveBeenCalledWith('tenant-xyz');
      expect(sriService.listarComprobantes).toHaveBeenCalledWith({
        ...query,
        emisorIds: ['emisor-x'],
      });
    });

    it('U-CTRL-LIST-10: ADMIN sin tenantId pasa directo al servicio', async () => {
      const userNoTenant: JwtPayload = { ...adminUser, tenantId: null };
      const query: QueryComprobantesDto = { page: 1, limit: 20 };
      sriService.listarComprobantes.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } as any);

      await controller.listarComprobantes(query, userNoTenant);

      expect(emisoresService.findByTenantId).not.toHaveBeenCalled();
      expect(sriService.listarComprobantes).toHaveBeenCalledWith(query);
    });
  });

  // ==========================================
  // obtenerComprobante — Multi-tenant
  // ==========================================
  describe('obtenerComprobante() — Multi-tenant', () => {
    it('U-CTRL-DET-01: SUPERADMIN obtiene comprobante sin validación de tenant', async () => {
      const mockComp = { id: 'comp-1', claveAcceso, detalles: [], xmlDisponible: true };
      sriService.obtenerComprobante.mockResolvedValue(mockComp as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      const result = await controller.obtenerComprobante(claveAcceso, superadminUser);

      expect(result).toEqual(mockComp);
      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, superadminUser);
    });

    it('U-CTRL-DET-02: ADMIN obtiene comprobante tras validación de tenant', async () => {
      const mockComp = { id: 'comp-1', claveAcceso, detalles: [], xmlDisponible: true };
      sriService.obtenerComprobante.mockResolvedValue(mockComp as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.obtenerComprobante(claveAcceso, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
    });

    it('U-CTRL-DET-03: comprobante no encontrado lanza NotFoundException', async () => {
      sriService.obtenerComprobante.mockResolvedValue(null);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await expect(controller.obtenerComprobante(claveAcceso, superadminUser)).rejects.toThrow(NotFoundException);
    });

    it('U-CTRL-DET-04: ADMIN sin acceso al RUC lanza ForbiddenException', async () => {
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Acceso denegado'));

      await expect(controller.obtenerComprobante(claveAcceso, adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-DET-05: USER obtiene comprobante tras validación de tenant', async () => {
      const mockComp = { id: 'comp-1', claveAcceso, detalles: [], xmlDisponible: true };
      sriService.obtenerComprobante.mockResolvedValue(mockComp as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.obtenerComprobante(claveAcceso, regularUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, regularUser);
    });
  });

  // ==========================================
  // descargarXml — Multi-tenant
  // ==========================================
  describe('descargarXml() — Multi-tenant', () => {
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    it('U-CTRL-XML-01: SUPERADMIN descarga XML tras validación', async () => {
      const xml = '<?xml version="1.0"?><factura/>';
      sriService.obtenerXmlAutorizado.mockResolvedValue(xml);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.descargarXml(claveAcceso, mockRes, superadminUser);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="${claveAcceso}.xml"`);
      expect(mockRes.send).toHaveBeenCalledWith(xml);
    });

    it('U-CTRL-XML-02: XML no disponible lanza NotFoundException', async () => {
      sriService.obtenerXmlAutorizado.mockResolvedValue(null);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await expect(controller.descargarXml(claveAcceso, mockRes, superadminUser)).rejects.toThrow(NotFoundException);
    });

    it('U-CTRL-XML-03: ADMIN sin acceso al RUC lanza ForbiddenException', async () => {
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Acceso denegado'));

      await expect(controller.descargarXml(claveAcceso, mockRes, adminUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================
  // anularComprobante — Multi-tenant
  // ==========================================
  describe('anularComprobante() — Multi-tenant', () => {
    it('U-CTRL-ANU-01: SUPERADMIN anula comprobante tras validación', async () => {
      const mockResult = { message: 'Comprobante anulado', claveAcceso, estadoAnterior: 'PENDIENTE' };
      sriService.anularComprobante.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      const result = await controller.anularComprobante(claveAcceso, superadminUser);

      expect(result.message).toContain('anulado');
      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, superadminUser);
    });

    it('U-CTRL-ANU-02: ADMIN anula tras validación de tenant', async () => {
      const mockResult = { message: 'Comprobante anulado', claveAcceso, estadoAnterior: 'PENDIENTE' };
      sriService.anularComprobante.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.anularComprobante(claveAcceso, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
    });

    it('U-CTRL-ANU-03: ADMIN sin acceso al RUC lanza ForbiddenException', async () => {
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Acceso denegado'));

      await expect(controller.anularComprobante(claveAcceso, adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-ANU-04: servicio lanza BadRequestException para AUTORIZADO', async () => {
      sriService.anularComprobante.mockRejectedValue(new BadRequestException('No se puede anular'));
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await expect(controller.anularComprobante(claveAcceso, superadminUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // reintentarComprobante — Multi-tenant
  // ==========================================
  describe('reintentarComprobante() — Multi-tenant', () => {
    it('U-CTRL-REI-01: SUPERADMIN reintenta tras validación', async () => {
      const mockResult = { claveAcceso, estado: 'AUTORIZADO', mensaje: 'Autorizado', fechaAutorizacion: '2026-02-07' };
      sriService.reintentarComprobante.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      const result = await controller.reintentarComprobante(claveAcceso, superadminUser);

      expect(result.estado).toBe('AUTORIZADO');
      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, superadminUser);
    });

    it('U-CTRL-REI-02: ADMIN reintenta tras validación de tenant', async () => {
      const mockResult = { claveAcceso, estado: 'AUTORIZADO', mensaje: 'Autorizado' };
      sriService.reintentarComprobante.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.reintentarComprobante(claveAcceso, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
    });

    it('U-CTRL-REI-03: ADMIN sin acceso al RUC lanza ForbiddenException', async () => {
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Acceso denegado'));

      await expect(controller.reintentarComprobante(claveAcceso, adminUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================
  // verificarEnSri — Multi-tenant
  // ==========================================
  describe('verificarEnSri() — Multi-tenant', () => {
    it('U-CTRL-VER-01: SUPERADMIN verifica tras validación', async () => {
      const mockResult = { claveAcceso, existeEnSri: true, estado: 'AUTORIZADO', sincronizado: true };
      sriService.verificarEnSri.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      const result = await controller.verificarEnSri(claveAcceso, superadminUser);

      expect(result.existeEnSri).toBe(true);
      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, superadminUser);
    });

    it('U-CTRL-VER-02: ADMIN verifica tras validación de tenant', async () => {
      const mockResult = { claveAcceso, existeEnSri: false, estado: 'NO EXISTE', sincronizado: false };
      sriService.verificarEnSri.mockResolvedValue(mockResult as any);
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await controller.verificarEnSri(claveAcceso, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
    });

    it('U-CTRL-VER-03: ADMIN sin acceso al RUC lanza ForbiddenException', async () => {
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('Acceso denegado'));

      await expect(controller.verificarEnSri(claveAcceso, adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-VER-04: servicio lanza BadRequestException para clave inválida', async () => {
      sriService.verificarEnSri.mockRejectedValue(new BadRequestException('Clave inválida'));
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);

      await expect(controller.verificarEnSri('123', superadminUser)).rejects.toThrow();
    });
  });

  // ==========================================
  // sincronizar — Multi-tenant
  // ==========================================
  describe('sincronizar() — Multi-tenant', () => {
    it('U-CTRL-SYN-01: SUPERADMIN sincroniza sin rucEmisor', async () => {
      const body = { estados: ['PENDIENTE'], reintentar: false, limite: 50 };
      const mockResult = { procesados: 5, actualizados: 3, reintentados: 0, errores: 0, detalle: [] };
      sriService.sincronizarConSri.mockResolvedValue(mockResult as any);

      const result = await controller.sincronizar(body, superadminUser);

      expect(result.procesados).toBe(5);
      expect(emisoresService.validateRucAccess).not.toHaveBeenCalled();
      expect(sriService.sincronizarConSri).toHaveBeenCalledWith(body);
    });

    it('U-CTRL-SYN-02: SUPERADMIN con rucEmisor pasa directo', async () => {
      const body = { estados: ['PENDIENTE'], rucEmisor: '0924383631001', limite: 50 };
      const mockResult = { procesados: 0, actualizados: 0, reintentados: 0, errores: 0, detalle: [] };
      sriService.sincronizarConSri.mockResolvedValue(mockResult as any);

      await controller.sincronizar(body, superadminUser);

      expect(emisoresService.validateRucAccess).not.toHaveBeenCalled();
    });

    it('U-CTRL-SYN-03: ADMIN sin rucEmisor lanza ForbiddenException', async () => {
      const body = { estados: ['PENDIENTE'], reintentar: false, limite: 50 };

      await expect(controller.sincronizar(body, adminUser)).rejects.toThrow(ForbiddenException);
      expect(sriService.sincronizarConSri).not.toHaveBeenCalled();
    });

    it('U-CTRL-SYN-04: ADMIN con rucEmisor valida acceso y sincroniza', async () => {
      const body = { estados: ['PENDIENTE'], rucEmisor: '0924383631001', limite: 50 };
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);
      sriService.sincronizarConSri.mockResolvedValue({ procesados: 2, actualizados: 1, reintentados: 0, errores: 0, detalle: [] } as any);

      const result = await controller.sincronizar(body, adminUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', adminUser);
      expect(result.procesados).toBe(2);
    });

    it('U-CTRL-SYN-05: ADMIN con rucEmisor ajeno lanza ForbiddenException', async () => {
      const body = { estados: ['PENDIENTE'], rucEmisor: '9999999999999', limite: 50 };
      emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('RUC no pertenece al tenant'));

      await expect(controller.sincronizar(body, adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-SYN-06: USER sin rucEmisor lanza ForbiddenException', async () => {
      const body = { estados: ['DEVUELTA'], reintentar: true, limite: 10 };

      await expect(controller.sincronizar(body, regularUser)).rejects.toThrow(ForbiddenException);
    });

    it('U-CTRL-SYN-07: USER con rucEmisor valida y sincroniza', async () => {
      const body = { estados: ['DEVUELTA'], rucEmisor: '0924383631001', reintentar: true, limite: 10 };
      emisoresService.validateRucAccess.mockResolvedValue(undefined as any);
      sriService.sincronizarConSri.mockResolvedValue({ procesados: 1, actualizados: 0, reintentados: 1, errores: 0, detalle: [] } as any);

      const result = await controller.sincronizar(body, regularUser);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith('0924383631001', regularUser);
      expect(result.reintentados).toBe(1);
    });

    it('U-CTRL-SYN-08: body vacío (estados por defecto) funciona para SUPERADMIN', async () => {
      const body = {};
      sriService.sincronizarConSri.mockResolvedValue({ procesados: 0, actualizados: 0, reintentados: 0, errores: 0, detalle: [] } as any);

      const result = await controller.sincronizar(body, superadminUser);

      expect(result.procesados).toBe(0);
      expect(sriService.sincronizarConSri).toHaveBeenCalledWith({});
    });
  });

  // ==========================================
  // QueryComprobantesDto — Validación
  // ==========================================
  describe('QueryComprobantesDto — Validación', () => {
    async function validateDto(dto: Partial<QueryComprobantesDto>): Promise<string[]> {
      const instance = plainToInstance(QueryComprobantesDto, dto);
      const errors = await validate(instance as any);
      return errors.map((e) => Object.values(e.constraints || {}).join(', '));
    }

    it('U-DTO-01: DTO vacío es válido (todos los campos son opcionales)', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-02: page=0 es inválido (min=1)', async () => {
      const errors = await validateDto({ page: 0 });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('less than');
    });

    it('U-DTO-03: page=1 es válido', async () => {
      const errors = await validateDto({ page: 1 });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-04: page negativo es inválido', async () => {
      const errors = await validateDto({ page: -5 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('U-DTO-05: limit=0 es inválido (min=1)', async () => {
      const errors = await validateDto({ limit: 0 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('U-DTO-06: limit=100 es válido (max=100)', async () => {
      const errors = await validateDto({ limit: 100 });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-07: limit=101 es inválido (max=100)', async () => {
      const errors = await validateDto({ limit: 101 });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('greater than');
    });

    it('U-DTO-08: limit negativo es inválido', async () => {
      const errors = await validateDto({ limit: -10 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('U-DTO-09: estado=AUTORIZADO es válido (enum)', async () => {
      const errors = await validateDto({ estado: EstadoComprobante.AUTORIZADO });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-10: estado=PENDIENTE es válido', async () => {
      const errors = await validateDto({ estado: EstadoComprobante.PENDIENTE });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-11: estado=DEVUELTA es válido', async () => {
      const errors = await validateDto({ estado: EstadoComprobante.DEVUELTA });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-12: estado=ANULADO es válido', async () => {
      const errors = await validateDto({ estado: EstadoComprobante.ANULADO });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-13: estado inválido (string cualquiera) es rechazado', async () => {
      const errors = await validateDto({ estado: 'INVALID' as any });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('estado');
    });

    it('U-DTO-14: tipoComprobante=01 (factura) es válido', async () => {
      const errors = await validateDto({ tipoComprobante: TipoComprobanteQuery.FACTURA });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-15: tipoComprobante=04 (nota crédito) es válido', async () => {
      const errors = await validateDto({ tipoComprobante: TipoComprobanteQuery.NOTA_CREDITO });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-16: tipoComprobante=07 (retención) es válido', async () => {
      const errors = await validateDto({ tipoComprobante: TipoComprobanteQuery.RETENCION });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-17: tipoComprobante inválido (99) es rechazado', async () => {
      const errors = await validateDto({ tipoComprobante: '99' as any });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('U-DTO-18: rucEmisor como string es válido', async () => {
      const errors = await validateDto({ rucEmisor: '0924383631001' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-19: fechaDesde como string es válido', async () => {
      const errors = await validateDto({ fechaDesde: '2026-01-01' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-20: fechaHasta como string es válido', async () => {
      const errors = await validateDto({ fechaHasta: '2026-12-31' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-21: establecimiento como string es válido', async () => {
      const errors = await validateDto({ establecimiento: '001' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-22: puntoEmision como string es válido', async () => {
      const errors = await validateDto({ puntoEmision: '001' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-23: cursor como string es válido', async () => {
      const errors = await validateDto({ cursor: 'base64encodedcursor' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-24: identificacionComprador como string es válido', async () => {
      const errors = await validateDto({ identificacionComprador: '1701234567' });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-25: DTO con todos los campos válidos pasa', async () => {
      const errors = await validateDto({
        rucEmisor: '0924383631001',
        identificacionComprador: '1701234567',
        tipoComprobante: TipoComprobanteQuery.FACTURA,
        estado: EstadoComprobante.AUTORIZADO,
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-12-31',
        establecimiento: '001',
        puntoEmision: '001',
        page: 1,
        limit: 50,
        cursor: 'abc123',
      });
      expect(errors).toHaveLength(0);
    });

    it('U-DTO-26: page como string se transforma a número', async () => {
      const instance = plainToInstance(QueryComprobantesDto, { page: '5' });
      expect(instance.page).toBe(5);
    });

    it('U-DTO-27: limit como string se transforma a número', async () => {
      const instance = plainToInstance(QueryComprobantesDto, { limit: '25' });
      expect(instance.limit).toBe(25);
    });

    it('U-DTO-28: page tiene valor por defecto 1', async () => {
      const instance = plainToInstance(QueryComprobantesDto, {});
      expect(instance.page).toBe(1);
    });

    it('U-DTO-29: limit tiene valor por defecto 20', async () => {
      const instance = plainToInstance(QueryComprobantesDto, {});
      expect(instance.limit).toBe(20);
    });
  });
});
