import { Module, forwardRef } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { SriModule } from '../sri/sri.module';
import { EmisoresModule } from '../emisores/emisores.module';

@Module({
  imports: [forwardRef(() => SriModule), EmisoresModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
