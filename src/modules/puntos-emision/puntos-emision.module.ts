import { Module } from '@nestjs/common';
import { PuntosEmisionController } from './puntos-emision.controller';
import { SecuencialesController } from './secuenciales.controller';
import { PuntosEmisionService } from './puntos-emision.service';
import { DatabaseModule } from '../../database';
import { EmisoresModule } from '../emisores/emisores.module';

@Module({
  imports: [DatabaseModule, EmisoresModule],
  controllers: [PuntosEmisionController, SecuencialesController],
  providers: [PuntosEmisionService],
  exports: [PuntosEmisionService],
})
export class PuntosEmisionModule {}
