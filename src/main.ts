import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { STORAGE_PATHS } from './common/utils/storage-paths';

/**
 * Detect which environment file is being used
 */
function detectEnvFile(): string {
  if (existsSync('.env.development')) return '.env.development';
  if (existsSync('.env.dev')) return '.env.dev';
  if (existsSync('.env')) return '.env';
  return 'variables de sistema';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ===== SEGURIDAD: HTTP Headers (Helmet) =====
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Necesario para Swagger UI
      contentSecurityPolicy: false, // Configurar por entorno si se requiere
    }),
  );

  // ===== SEGURIDAD: CORS restringido =====
  const nodeEnvForSwagger = configService.get<string>('nodeEnv') || 'development';
  const allowedOriginsStr = configService.get<string>(
    'cors.allowedOrigins',
    'http://localhost:3000,http://localhost:3001',
  );
  const allowedOrigins = allowedOriginsStr.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // FIX RED TEAM: En producción, rechazar requests sin Origin header
      // Solo permitir en development/test para herramientas como Postman/curl
      if (!origin) {
        if (nodeEnvForSwagger === 'production') {
          return callback(
            new Error('CORS: Requests sin Origin header no permitidos en producción'),
          );
        }
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true,
  });

  // ===== VALIDACIÓN GLOBAL =====
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ===== FILTRO DE EXCEPCIONES GLOBAL =====
  app.useGlobalFilters(new AllExceptionsFilter());

  // ===== SWAGGER — Open API Facturación SRI =====
  // nodeEnvForSwagger is already declared above (before CORS)
  if (nodeEnvForSwagger !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Open API Facturación SRI')
      .setDescription(
        `## API Enterprise de Facturación Electrónica para el SRI Ecuador

**Multi-tenant** | **XAdES-BES** | **SOAP SRI** | **Webhooks** | **JWT Auth**

### 🔐 Autenticación
Todos los endpoints requieren un token JWT.  
1. Ejecuta \`POST /auth/login\` con tus credenciales.  
2. Copia el \`accessToken\` de la respuesta.  
3. Haz clic en el botón **Authorize 🔒** y pégalo.

### 🌐 Ambientes SRI
- **Pruebas:** Usar \`"ambiente": "1"\` en las peticiones.
- **Producción:** Usar \`"ambiente": "2"\` (solo cuando el SRI apruebe la cuenta).`,
      )
      .setVersion('2.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en POST /auth/login',
        },
        'JWT',
      )
      .addTag('Auth - Autenticación', 'Login, registro y gestión de usuarios')
      .addTag('Status', 'Estado del servidor y health checks')
      .addTag(
        'SRI - Facturación Electrónica',
        'Emisión y gestión de comprobantes electrónicos (Facturas, NC, ND, Retenciones, Guías)',
      )
      .addTag('Emisores', 'Gestión de empresas emisoras de documentos')
      .addTag(
        'Emisores - Puntos de Emisión',
        'Gestión de puntos de emisión (cajas/sucursales)',
      )
      .addTag(
        'Emisores - Secuenciales',
        'Gestión de secuenciales de comprobantes',
      )
      .addTag(
        'Tenants',
        'Gestión de inquilinos/clientes del sistema multi-tenant',
      )
      .addTag('Certificates', 'Gestión de certificados digitales P12')
      .addTag('Webhooks', 'Configuración de notificaciones por eventos')
      .addTag('Generate PDF', 'Generación de PDFs con Carbone.io')
      .addTag('Documents', 'Generación de documentos multi-formato')
      .addTag('Templates', 'Gestión de plantillas de documentos')
      .addTag('Signature', 'Firma digital de PDFs')
      .addTag('Images', 'Gestión de imágenes')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // Mantiene el token JWT entre recargas del Swagger UI
      },
    });
    logger.log(`Swagger habilitado en /api (entorno: ${nodeEnvForSwagger})`);
  } else {
    logger.warn('Swagger DESHABILITADO en producción');
  }

  // ===== INICIALIZAR DIRECTORIOS =====
  const templatesDir = STORAGE_PATHS.templates;
  const pdfDir = STORAGE_PATHS.pdfs;
  const certsDir = STORAGE_PATHS.certs;
  void STORAGE_PATHS.pdfsConFirma;
  void STORAGE_PATHS.pdfsOthers;
  void STORAGE_PATHS.pdfsDocuments;
  void STORAGE_PATHS.pdfsImages;

  // ===== ARRANQUE =====
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  const envFile = detectEnvFile();
  const port = configService.get<number>('port')!;
  const publicUrl = configService.get<string>('publicUrl')!;
  const dbHost = configService.get<string>('database.host') || 'No configurado';
  const dbName = configService.get<string>('database.name') || 'No configurado';

  // ===== GRACEFUL SHUTDOWN =====
  // Permite que NestJS ejecute los hooks OnModuleDestroy (cierra pool DB, etc.)
  // al recibir SIGTERM/SIGINT (Docker stop, Kubernetes pod termination)
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`
=======================================================
  Open API Facturación SRI — Facturación Electrónica Ecuador
=======================================================
  Entorno:    ${nodeEnv.toUpperCase()}
  Env File:   ${envFile}
-------------------------------------------------------
  Servidor:   http://localhost:${port}
  URL Pública:${publicUrl}
  Swagger:    http://localhost:${port}/api
-------------------------------------------------------
  Base de Datos: ${dbHost} / ${dbName}
  Certificados:  ${certsDir}
  Templates:     ${templatesDir}
  PDFs:          ${pdfDir}
=======================================================
`);
}
void bootstrap();
