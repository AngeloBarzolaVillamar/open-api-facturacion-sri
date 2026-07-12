import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { SriController } from '../src/modules/sri/sri.controller';
import { SriService } from '../src/modules/sri/sri.service';
import { EmisoresService } from '../src/modules/emisores/emisores.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtPayload, UserRole } from '../src/modules/auth/dto/auth.dto';

describe('SRI Consultas — Integration Tests (supertest)', () => {
  let app: INestApplication<App>;
  let sriService: jest.Mocked<SriService>;
  let emisoresService: jest.Mocked<EmisoresService>;

  const claveAcceso = '0702202601092438363100110010010000000161245294013';
  const rucFromClave = '0924383631001';

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

  const mockPaginated = {
    data: [
      {
        id: 'comp-1',
        emisorId: 'emisor-1',
        claveAcceso,
        tipoComprobante: '01',
        tipoComprobanteDescripcion: 'Factura',
        ambiente: '1',
        fechaEmision: '07/02/2026',
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000016',
        rucEmisor: rucFromClave,
        razonSocialEmisor: 'Empresa Test',
        identificacionComprador: '1701234567',
        razonSocialComprador: 'Cliente Test',
        subtotal: 100.0,
        totalImpuestos: 12.0,
        total: 112.0,
        estado: 'AUTORIZADO',
      },
    ],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    nextCursor: null,
    hasMore: false,
  };

  const mockDetalle = {
    id: 'comp-1',
    claveAcceso,
    tipoComprobante: '01',
    tipoComprobanteDescripcion: 'Factura',
    ambiente: '1',
    fechaEmision: '07/02/2026',
    establecimiento: '001',
    puntoEmision: '001',
    secuencial: '000000016',
    rucEmisor: rucFromClave,
    razonSocialEmisor: 'Empresa Test',
    identificacionComprador: '1701234567',
    razonSocialComprador: 'Cliente Test',
    subtotal: 100.0,
    totalImpuestos: 12.0,
    total: 112.0,
    estado: 'AUTORIZADO',
    detalles: [],
    infoAdicional: [],
    xmlDisponible: true,
  };

  const mockVerificacion = {
    claveAcceso,
    existeEnSri: true,
    estado: 'AUTORIZADO',
    fechaAutorizacion: '2026-02-07T12:00:00Z',
    numeroAutorizacion: '07/02/2026-1234567890-1234567890',
    mensajes: [],
    estadoLocal: 'AUTORIZADO',
    sincronizado: true,
  };

  const mockSincronizacion = {
    procesados: 5,
    actualizados: 3,
    reintentados: 1,
    errores: 0,
    detalle: [],
  };

  async function createAppWithUser(user: JwtPayload) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SriController],
      providers: [
        {
          provide: SriService,
          useValue: {
            listarComprobantes: jest.fn().mockResolvedValue(mockPaginated),
            obtenerComprobante: jest.fn().mockResolvedValue(mockDetalle),
            obtenerXmlAutorizado: jest.fn().mockResolvedValue('<?xml version="1.0"?><factura/>'),
            anularComprobante: jest.fn().mockResolvedValue({
              message: 'Comprobante anulado exitosamente',
              claveAcceso,
              estadoAnterior: 'PENDIENTE',
            }),
            reintentarComprobante: jest.fn().mockResolvedValue({
              claveAcceso,
              estado: 'AUTORIZADO',
              mensaje: 'Comprobante autorizado tras reintento',
            }),
            verificarEnSri: jest.fn().mockResolvedValue(mockVerificacion),
            sincronizarConSri: jest.fn().mockResolvedValue(mockSincronizacion),
          },
        },
        {
          provide: EmisoresService,
          useValue: {
            validateRucAccess: jest.fn().mockResolvedValue(undefined),
            findByTenantId: jest.fn().mockResolvedValue([
              { id: 'emisor-1', ruc: rucFromClave, razon_social: 'Empresa Test' },
            ]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const request = context.switchToHttp().getRequest();
              request.user = user;
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = user;
          return true;
        },
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const appInstance = moduleFixture.createNestApplication();
    appInstance.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await appInstance.init();
    return { appInstance, moduleFixture };
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  // ==========================================
  // GET /sri/comprobantes
  // ==========================================
  describe('GET /sri/comprobantes', () => {
    it('I-CONS-01: retorna 200 con lista paginada (SUPERADMIN)', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].claveAcceso).toBe(claveAcceso);
    });

    it('I-CONS-02: pasa filtros por query string correctamente', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);

      await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .query({ estado: 'AUTORIZADO', tipoComprobante: '01', page: 1, limit: 10 })
        .expect(200);

      expect(sriService.listarComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'AUTORIZADO',
          tipoComprobante: '01',
          page: 1,
          limit: 10,
        }),
      );
    });

    it('I-CONS-03: ADMIN sin rucEmisor filtra por emisores del tenant', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      emisoresService = moduleFixture.get(EmisoresService);

      await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .expect(200);

      expect(emisoresService.findByTenantId).toHaveBeenCalledWith('tenant-abc');
      expect(sriService.listarComprobantes).toHaveBeenCalledWith(
        expect.objectContaining({
          emisorIds: ['emisor-1'],
        }),
      );
    });

    it('I-CONS-04: ADMIN con rucEmisor valida acceso', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);

      await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .query({ rucEmisor: rucFromClave })
        .expect(200);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
    });

    it('I-CONS-05: ADMIN con rucEmisor ajeno retorna 403', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('No tiene acceso al RUC especificado'),
      );

      const res = await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .query({ rucEmisor: '9999999999999' })
        .expect(403);

      expect(res.body).toHaveProperty('message');
    });

    it('I-CONS-06: page=0 retorna error de validación 400', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .query({ page: 0 })
        .expect(400);
    });

    it('I-CONS-07: limit=200 excede máximo (100) retorna 400', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      await request(app.getHttpServer())
        .get('/sri/comprobantes')
        .query({ limit: 200 })
        .expect(400);
    });
  });

  // ==========================================
  // GET /sri/comprobantes/:claveAcceso
  // ==========================================
  describe('GET /sri/comprobantes/:claveAcceso', () => {
    it('I-CONS-08: retorna 200 con detalle del comprobante (SUPERADMIN)', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}`)
        .expect(200);

      expect(res.body.claveAcceso).toBe(claveAcceso);
      expect(res.body.tipoComprobante).toBe('01');
      expect(res.body.xmlDisponible).toBe(true);
    });

    it('I-CONS-09: comprobante no encontrado retorna 404', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      (sriService.obtenerComprobante as jest.Mock).mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}`)
        .expect(404);
    });

    it('I-CONS-10: ADMIN accede a comprobante de su tenant', async () => {
      const { appInstance } = await createAppWithUser(adminUser);
      app = appInstance as any;

      await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}`)
        .expect(200);
    });

    it('I-CONS-11: ADMIN sin acceso al RUC retorna 403', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Acceso denegado'),
      );

      await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}`)
        .expect(403);
    });
  });

  // ==========================================
  // GET /sri/comprobantes/:claveAcceso/xml
  // ==========================================
  describe('GET /sri/comprobantes/:claveAcceso/xml', () => {
    it('I-CONS-12: retorna 200 con XML content-type application/xml', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}/xml`)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.headers['content-disposition']).toContain(`${claveAcceso}.xml`);
      expect(res.text).toContain('<?xml');
    });

    it('I-CONS-13: XML no disponible retorna 404', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      (sriService.obtenerXmlAutorizado as jest.Mock).mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}/xml`)
        .expect(404);
    });

    it('I-CONS-14: ADMIN sin acceso al RUC retorna 403', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Acceso denegado'),
      );

      await request(app.getHttpServer())
        .get(`/sri/comprobantes/${claveAcceso}/xml`)
        .expect(403);
    });
  });

  // ==========================================
  // PATCH /sri/comprobantes/:claveAcceso/anular
  // ==========================================
  describe('PATCH /sri/comprobantes/:claveAcceso/anular', () => {
    it('I-CONS-15: retorna 200 al anular comprobante pendiente', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .patch(`/sri/comprobantes/${claveAcceso}/anular`)
        .expect(200);

      expect(res.body.message).toContain('anulado');
      expect(res.body.claveAcceso).toBe(claveAcceso);
      expect(res.body.estadoAnterior).toBe('PENDIENTE');
    });

    it('I-CONS-16: anular comprobante autorizado retorna 400', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      (sriService.anularComprobante as jest.Mock).mockRejectedValueOnce(
        new BadRequestException('No se puede anular un comprobante AUTORIZADO'),
      );

      const res = await request(app.getHttpServer())
        .patch(`/sri/comprobantes/${claveAcceso}/anular`)
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });

    it('I-CONS-17: comprobante no encontrado al anular retorna 400', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      (sriService.anularComprobante as jest.Mock).mockRejectedValueOnce(
        new BadRequestException('Comprobante no encontrado'),
      );

      await request(app.getHttpServer())
        .patch(`/sri/comprobantes/${claveAcceso}/anular`)
        .expect(400);
    });

    it('I-CONS-18: ADMIN sin acceso al RUC retorna 403 al anular', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Acceso denegado'),
      );

      await request(app.getHttpServer())
        .patch(`/sri/comprobantes/${claveAcceso}/anular`)
        .expect(403);
    });
  });

  // ==========================================
  // POST /sri/comprobantes/:claveAcceso/reintentar
  // ==========================================
  describe('POST /sri/comprobantes/:claveAcceso/reintentar', () => {
    it('I-CONS-19: retorna 200 al reintentar comprobante devuelto', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .post(`/sri/comprobantes/${claveAcceso}/reintentar`)
        .expect(200);

      expect(res.body.claveAcceso).toBe(claveAcceso);
      expect(res.body.estado).toBe('AUTORIZADO');
      expect(res.body.mensaje).toContain('autorizado');
    });

    it('I-CONS-20: reintentar comprobante no encontrado retorna error', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);
      (sriService.reintentarComprobante as jest.Mock).mockRejectedValueOnce(
        new BadRequestException('Comprobante no encontrado'),
      );

      await request(app.getHttpServer())
        .post(`/sri/comprobantes/${claveAcceso}/reintentar`)
        .expect(400);
    });

    it('I-CONS-21: ADMIN sin acceso al RUC retorna 403 al reintentar', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Acceso denegado'),
      );

      await request(app.getHttpServer())
        .post(`/sri/comprobantes/${claveAcceso}/reintentar`)
        .expect(403);
    });
  });

  // ==========================================
  // GET /sri/verificar/:claveAcceso
  // ==========================================
  describe('GET /sri/verificar/:claveAcceso', () => {
    it('I-CONS-22: retorna 200 con estado de verificación SRI', async () => {
      const { appInstance } = await createAppWithUser(superadminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .get(`/sri/verificar/${claveAcceso}`)
        .expect(200);

      expect(res.body.claveAcceso).toBe(claveAcceso);
      expect(res.body.existeEnSri).toBe(true);
      expect(res.body.estado).toBe('AUTORIZADO');
      expect(res.body.sincronizado).toBe(true);
    });

    it('I-CONS-23: ADMIN accede a verificación de su tenant', async () => {
      const { appInstance } = await createAppWithUser(adminUser);
      app = appInstance as any;

      await request(app.getHttpServer())
        .get(`/sri/verificar/${claveAcceso}`)
        .expect(200);
    });

    it('I-CONS-24: ADMIN sin acceso al RUC retorna 403 al verificar', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Acceso denegado'),
      );

      await request(app.getHttpServer())
        .get(`/sri/verificar/${claveAcceso}`)
        .expect(403);
    });
  });

  // ==========================================
  // POST /sri/sincronizar
  // ==========================================
  describe('POST /sri/sincronizar', () => {
    it('I-CONS-25: SUPERADMIN sincroniza sin rucEmisor', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);

      const res = await request(app.getHttpServer())
        .post('/sri/sincronizar')
        .send({})
        .expect(200);

      expect(res.body.procesados).toBe(5);
      expect(res.body.actualizados).toBe(3);
      expect(sriService.sincronizarConSri).toHaveBeenCalledWith({});
    });

    it('I-CONS-26: SUPERADMIN sincroniza con filtros', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(superadminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);

      const body = { estados: ['PENDIENTE', 'DEVUELTA'], reintentar: true, limite: 10 };

      await request(app.getHttpServer())
        .post('/sri/sincronizar')
        .send(body)
        .expect(200);

      expect(sriService.sincronizarConSri).toHaveBeenCalledWith(body);
    });

    it('I-CONS-27: ADMIN sin rucEmisor retorna 403', async () => {
      const { appInstance } = await createAppWithUser(adminUser);
      app = appInstance as any;

      const res = await request(app.getHttpServer())
        .post('/sri/sincronizar')
        .send({})
        .expect(403);

      expect(res.body.message).toContain('rucEmisor');
    });

    it('I-CONS-28: ADMIN con rucEmisor válido sincroniza', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      sriService = moduleFixture.get(SriService);

      await request(app.getHttpServer())
        .post('/sri/sincronizar')
        .send({ rucEmisor: rucFromClave })
        .expect(200);

      expect(emisoresService.validateRucAccess).toHaveBeenCalledWith(rucFromClave, adminUser);
      expect(sriService.sincronizarConSri).toHaveBeenCalledWith({ rucEmisor: rucFromClave });
    });

    it('I-CONS-29: ADMIN con rucEmisor ajeno retorna 403', async () => {
      const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
      app = appInstance as any;
      emisoresService = moduleFixture.get(EmisoresService);
      (emisoresService.validateRucAccess as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('No tiene acceso al RUC'),
      );

      await request(app.getHttpServer())
        .post('/sri/sincronizar')
        .send({ rucEmisor: '9999999999999' })
        .expect(403);
    });
  });
});
