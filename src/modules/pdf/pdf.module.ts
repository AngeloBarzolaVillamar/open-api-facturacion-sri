import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfImageService } from './pdf-image.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [PdfController],
  providers: [PdfService, PdfImageService],
  exports: [PdfService, PdfImageService],
})
export class PdfModule {}
