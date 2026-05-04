import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * BUG-06 / Módulo global de colas con BullMQ + Redis.
 * Centraliza la conexión a Redis y define las colas del sistema.
 */
@Global()
@Module({
  imports: [
    // Conexión a Redis para BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', '') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null, // Requerido por BullMQ
        },
      }),
    }),

    // Cola: Emisión de comprobantes
    BullModule.registerQueue({
      name: 'sri-emision',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000 }, // Mantener últimos 1000 jobs completados
        removeOnFail: { count: 5000 },     // Mantener últimos 5000 jobs fallidos
      },
    }),

    // Cola: Webhook dispatch
    BullModule.registerQueue({
      name: 'webhook-dispatch',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000, // 3s → 6s → 12s → 24s → 48s
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2000 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
