import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { TemplateModule } from '../template/template.module';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseHealthIndicator } from './database.health';

@Module({
  imports: [TerminusModule, TemplateModule, DatabaseModule],
  controllers: [StatusController],
  providers: [StatusService, DatabaseHealthIndicator],
})
export class StatusModule {}
