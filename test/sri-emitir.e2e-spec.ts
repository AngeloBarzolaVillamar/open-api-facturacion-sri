import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { SriController } from '../src/modules/sri/sri.controller';
import { SriService } from '../src/modules/sri/sri.service';
import { EmisoresService } from '../src/modules/emisores/emisores.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtPayload, UserRole } from '../src/modules/auth/dto/auth.dto';
import { TipoIdentificacion, FormaPago } from '../src/modules/sri/constants';

/**
 * Integration tests para endpoints de emisión de factura
 * Usa supertest con la app NestJS real (controllers + pipes + guards)
 */
describe('SRI Emitir Factura — Integration Tests (supertest)', () => {
  let app: INestApplication<any>;
  let sriService: jest.Mocked<SriService>;
  let emisoresService: jest.Mocked<EmisoresService>;

  const adminUser: JwtPayload = {
    sub: 'user-1',
    email: 'user@test.com',
    rol: UserRole.ADMIN,
    tenantId: 'tenant-abc',
  };

  function createValidFacturaBody() {
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
    };
  }

  async function createAppWithUser(user: JwtPayload) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SriController],
      providers: [
        {
          provide: SriService,
          useValue: {
            emitirFactura: jest.fn(),
            generarXmlPreview: jest.fn(),
            generarFacturaFirmadaDebug: jest.fn(),
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
              return null;
            }),
          },
        },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = user;
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = user;
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
  // I-EMI-01: POST /sri/emitir/factura — emisión síncrona exitosa
  // ==========================================
  it('I-EMI-01: POST /sri/emitir/factura retorna 201 con FacturaResponseDto', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    sriService = moduleFixture.get(SriService);

    sriService.emitirFactura.mockResolvedValue({
      success: true,
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      estado: 'AUTORIZADO',
      fechaAutorizacion: '2026-02-07T12:00:00Z',
      numeroAutorizacion: '1234567890',
      mensajes: [],
    } as any);

    const res = await request(app.getHttpServer())
      .post('/sri/emitir/factura')
      .send(createValidFacturaBody())
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.estado).toBe('AUTORIZADO');
    expect(res.body.claveAcceso).toHaveLength(49);
  });

  // ==========================================
  // I-EMI-02: POST /sri/emitir/factura — respuesta asíncrona (EN_COLA)
  // ==========================================
  it('I-EMI-02: POST /sri/emitir/factura retorna 201 con EN_COLA', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    sriService = moduleFixture.get(SriService);

    sriService.emitirFactura.mockResolvedValue({
      mensaje: 'Factura encolada para emisión asíncrona',
      jobId: 'job-789',
      estado: 'EN_COLA',
    } as any);

    const res = await request(app.getHttpServer())
      .post('/sri/emitir/factura')
      .send(createValidFacturaBody())
      .expect(201);

    expect(res.body.estado).toBe('EN_COLA');
    expect(res.body.jobId).toBe('job-789');
  });

  // ==========================================
  // I-EMI-03: POST /sri/emitir/factura — DTO inválido (sin emisor)
  // ==========================================
  it('I-EMI-03: POST /sri/emitir/factura con DTO sin emisor retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    (body as any).emisor = {};

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-04: POST /sri/emitir/factura — sin fechaEmision
  // ==========================================
  it('I-EMI-04: POST /sri/emitir/factura sin fechaEmision retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    delete (body as any).fechaEmision;

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-05: POST /sri/emitir/factura — sin detalles
  // ==========================================
  it('I-EMI-05: POST /sri/emitir/factura sin detalles retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    delete (body as any).detalles;

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-06: POST /sri/emitir/factura — RUC no autorizado
  // ==========================================
  it('I-EMI-06: POST /sri/emitir/factura con RUC no autorizado retorna 403', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    emisoresService = moduleFixture.get(EmisoresService);

    emisoresService.validateRucAccess.mockRejectedValue(new ForbiddenException('RUC no pertenece al tenant'));

    await request(app.getHttpServer())
      .post('/sri/emitir/factura')
      .send(createValidFacturaBody())
      .expect(403);
  });

  // ==========================================
  // I-EMI-07: POST /sri/emitir/factura — forbidNonWhitelisted
  // ==========================================
  it('I-EMI-07: POST /sri/emitir/factura con campo extra retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = { ...createValidFacturaBody(), campoExtra: 'no permitido' };

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-08: POST /sri/preview/factura — XML preview exitoso
  // ==========================================
  it('I-EMI-08: POST /sri/preview/factura retorna 200 con XML', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    sriService = moduleFixture.get(SriService);

    sriService.generarXmlPreview.mockReturnValue('<factura>preview</factura>');

    const res = await request(app.getHttpServer())
      .post('/sri/preview/factura')
      .send(createValidFacturaBody())
      .expect(200);

    expect(res.body.xml).toBe('<factura>preview</factura>');
  });

  // ==========================================
  // I-EMI-09: POST /sri/preview/factura — sin emisor
  // ==========================================
  it('I-EMI-09: POST /sri/preview/factura sin emisor retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    (body as any).emisor = {};

    await request(app.getHttpServer()).post('/sri/preview/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-10: POST /sri/debug/factura-firmada — exitoso en test
  // ==========================================
  it('I-EMI-10: POST /sri/debug/factura-firmada retorna 200 con XML firmado', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    sriService = moduleFixture.get(SriService);

    sriService.generarFacturaFirmadaDebug.mockResolvedValue({
      claveAcceso: '0702202601092438363100110010010000000161245294013',
      xmlSinFirma: '<xml/>',
      xmlFirmado: '<xml signed/>',
    });

    const res = await request(app.getHttpServer())
      .post('/sri/debug/factura-firmada')
      .send(createValidFacturaBody())
      .expect(200);

    expect(res.body.claveAcceso).toHaveLength(49);
    expect(res.body.xmlFirmado).toBeDefined();
  });

  // ==========================================
  // I-EMI-11: POST /sri/debug/factura-firmada — bloqueado en producción
  // ==========================================
  it('I-EMI-11: POST /sri/debug/factura-firmada retorna 403 en producción', async () => {
    const { appInstance, moduleFixture } = await createAppWithUser(adminUser);
    app = appInstance;
    const configService = moduleFixture.get(ConfigService);
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return null;
    });

    await request(app.getHttpServer())
      .post('/sri/debug/factura-firmada')
      .send(createValidFacturaBody())
      .expect(403);
  });

  // ==========================================
  // I-EMI-12: POST /sri/emitir/factura — fechaEmision formato inválido
  // ==========================================
  it('I-EMI-12: POST /sri/emitir/factura con fechaEmision inválida retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = { ...createValidFacturaBody(), fechaEmision: '2026-02-07' };

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-13: POST /sri/emitir/factura — comprador sin identificacion
  // ==========================================
  it('I-EMI-13: POST /sri/emitir/factura sin identificacion de comprador retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    delete (body.comprador as any).identificacion;

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-14: POST /sri/emitir/factura — detalle sin impuestos
  // ==========================================
  it('I-EMI-14: POST /sri/emitir/factura con detalle sin impuestos retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    delete (body.detalles[0] as any).impuestos;

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });

  // ==========================================
  // I-EMI-15: POST /sri/emitir/factura — sin pagos
  // ==========================================
  it('I-EMI-15: POST /sri/emitir/factura sin pagos retorna 400', async () => {
    const { appInstance } = await createAppWithUser(adminUser);
    app = appInstance;

    const body = createValidFacturaBody();
    delete (body as any).pagos;

    await request(app.getHttpServer()).post('/sri/emitir/factura').send(body).expect(400);
  });
});
