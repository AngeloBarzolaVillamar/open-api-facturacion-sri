import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';

import configuration from './config/configuration';

// Common Services
import { EncryptionModule } from './common/services/encryption.module';
import { AuditModule } from './common/services/audit.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { QueueModule } from './common/queues/queue.module';
import { RedisCacheModule } from './common/cache/redis-cache.module';

// Database Module
import { DatabaseModule } from './database';

// Auth Module
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

// Feature Modules
import { TemplateModule } from './modules/template/template.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { SignatureModule } from './modules/signature/signature.module';
import { DocumentModule } from './modules/document/document.module';
import { ImageModule } from './modules/image/image.module';
import { StatusModule } from './modules/status/status.module';
import { SriModule } from './modules/sri/sri.module';
import { EmisoresModule } from './modules/emisores/emisores.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PuntosEmisionModule } from './modules/puntos-emision/puntos-emision.module';

import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),

    // Rate Limiting Global
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('throttler.ttl', 60000),
          limit: configService.get<number>('throttler.limit', 100),
        },
      ],
      inject: [ConfigService],
    }),

    // Serve Static Files
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const pdfDir = configService.get<string>('directories.pdfs')!;
        return [
          {
            rootPath: join(pdfDir, 'con_firma'),
            serveRoot: '/pdfs/con_firma',
          },
          {
            rootPath: join(pdfDir, 'others'),
            serveRoot: '/pdfs/others',
          },
          {
            rootPath: join(pdfDir, 'documents'),
            serveRoot: '/pdfs/documents',
          },
          {
            rootPath: pdfDir,
            serveRoot: '/pdfs',
          },
          {
            rootPath: join(pdfDir, 'images'),
            serveRoot: '/images',
          },
        ];
      },
      inject: [ConfigService],
    }),

    // Common Services
    EncryptionModule,
    AuditModule,
    QueueModule,
    RedisCacheModule,

    // Database Module
    DatabaseModule,

    // Auth Module (before feature modules)
    AuthModule,

    // Feature Modules
    TemplateModule,
    PdfModule,
    CertificateModule,
    SignatureModule,
    DocumentModule,
    ImageModule,
    StatusModule,
    SriModule,
    EmisoresModule,
    WebhooksModule,
    TenantsModule,
    PuntosEmisionModule,
  ],
  providers: [
    // Guard JWT global — protege todos los endpoints excepto @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Guard de roles global
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Guard de rate limiting global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Interceptor de auditoría global
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}

