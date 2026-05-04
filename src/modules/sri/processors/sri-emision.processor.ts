import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FacturaService } from '../services/factura.service';
import { NotaCreditoService } from '../services/nota-credito.service';
import { NotaDebitoService } from '../services/nota-debito.service';
import { RetencionService } from '../services/retencion.service';
import { GuiaRemisionService } from '../services/guia-remision.service';

@Processor('sri-emision')
export class SriEmisionProcessor extends WorkerHost {
  private readonly logger = new Logger(SriEmisionProcessor.name);

  constructor(
    private readonly facturaService: FacturaService,
    private readonly notaCreditoService: NotaCreditoService,
    private readonly notaDebitoService: NotaDebitoService,
    private readonly retencionService: RetencionService,
    private readonly guiaRemisionService: GuiaRemisionService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { tipo, dto } = job.data;
    this.logger.log(`Procesando emisión asíncrona de ${tipo} - Job ID: ${job.id}`);

    try {
      switch (tipo) {
        case 'FACTURA':
          return await this.facturaService.emitirFactura(dto);
        case 'NOTA_CREDITO':
          return await this.notaCreditoService.emitirNotaCredito(dto);
        case 'NOTA_DEBITO':
          return await this.notaDebitoService.emitirNotaDebito(dto);
        case 'RETENCION':
          return await this.retencionService.emitirRetencion(dto);
        case 'GUIA_REMISION':
          return await this.guiaRemisionService.emitirGuiaRemision(dto);
        default:
          throw new Error(`Tipo de comprobante no soportado: ${tipo}`);
      }
    } catch (error: any) {
      this.logger.error(`Error procesando job ${job.id} de tipo ${tipo}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
