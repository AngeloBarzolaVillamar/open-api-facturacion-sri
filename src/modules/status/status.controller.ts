import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatusService } from './status.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';

@ApiTags('Status')
@Public()
@Controller()
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /**
   * GET /status
   * Get server status with detailed health checks
   */
  @Get('status')
  @HealthCheck()
  @ApiOperation({ summary: 'Obtener estado del servidor detallado' })
  @ApiResponse({
    status: 200,
    description: 'Estado del servidor y dependencias',
  })
  async getStatus() {
    // Info base estática
    const baseInfo = this.statusService.getStatus();

    // Health checks reales
    const healthCheck = await this.health.check([
      () => this.db.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
    ]);

    return {
      ...baseInfo,
      health: healthCheck,
    };
  }

  /**
   * GET /
   * Redirect to status
   */
  @Get()
  @Redirect('/status', 302)
  @ApiOperation({ summary: 'Redirigir a status' })
  root() {
    // Redirect handled by @Redirect decorator
  }
}
