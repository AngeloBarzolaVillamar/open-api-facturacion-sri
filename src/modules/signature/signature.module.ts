import { Module } from '@nestjs/common';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';
import { PdfModule } from '../pdf/pdf.module';
import { CertificateModule } from '../certificate/certificate.module';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [PdfModule, CertificateModule, TemplateModule],
  controllers: [SignatureController],
  providers: [SignatureService],
  exports: [SignatureService],
})
export class SignatureModule {}
