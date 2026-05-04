import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.query('SELECT 1');
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
