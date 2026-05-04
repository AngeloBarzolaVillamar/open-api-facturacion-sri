import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

/**
 * Módulo de caché distribuido con Redis.
 * Reemplaza Map in-memory para consistencia multi-nodo.
 * TTL configurable via CACHE_TTL_SECONDS (default: 300s = 5min).
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');
        const ttl = configService.get<number>('CACHE_TTL_SECONDS', 300);

        return {
          store: await redisStore({
            host: redisHost,
            port: redisPort,
            password: redisPassword || undefined,
            db: 1, // DB separada de BullMQ (que usa DB 0)
            ttl: ttl * 1000, // cache-manager espera ms
          }),
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
