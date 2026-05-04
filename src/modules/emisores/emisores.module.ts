import { Module } from '@nestjs/common';
import { EmisoresController } from './emisores.controller';
import { EmisoresService } from './emisores.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EmisoresController],
  providers: [EmisoresService],
  exports: [EmisoresService],
})
export class EmisoresModule {}
