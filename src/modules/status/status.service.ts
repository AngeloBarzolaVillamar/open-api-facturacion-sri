import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { TemplateService } from '../template/template.service';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

export interface StatusResponse {
  success: boolean;
  status: string;
  message: string;
  data: {
    directories: Record<string, boolean>;
    fileCount: Record<string, number>;
    templates: string[];
    config: {
      carboneApi: string;
      publicUrl: string;
      port: number;
    };
  };
}

@Injectable()
export class StatusService {
  constructor(
    private configService: ConfigService,
    private templateService: TemplateService,
  ) {}

  /**
   * Get server status
   */
  getStatus(): StatusResponse {
    const pdfDir = STORAGE_PATHS.pdfs;
    const certsDir = STORAGE_PATHS.certs;
    const templatesDir = STORAGE_PATHS.templates;

    // Check directory existence
    const dirStatus = {
      pdfs: existsSync(pdfDir),
      pdfs_con_firma: existsSync(join(pdfDir, 'con_firma')),
      pdfs_others: existsSync(join(pdfDir, 'others')),
      certs: existsSync(certsDir),
      templates: existsSync(templatesDir),
    };

    // Count files in each directory
    const fileCount = {
      pdfs_con_firma: existsSync(join(pdfDir, 'con_firma'))
        ? readdirSync(join(pdfDir, 'con_firma')).length
        : 0,
      pdfs_others: existsSync(join(pdfDir, 'others'))
        ? readdirSync(join(pdfDir, 'others')).length
        : 0,
      certs: existsSync(certsDir)
        ? readdirSync(certsDir).filter((f) => f.endsWith('.p12')).length
        : 0,
    };

    // Get template names
    const templates = this.templateService
      .listTemplatesWithMetadata()
      .map((t) => t.name);

    return {
      success: true,
      status: 'ok',
      message: 'Servidor funcionando correctamente',
      data: {
        directories: dirStatus,
        fileCount: fileCount,
        templates: templates,
        config: {
          carboneApi: this.configService.get<string>('carboneApi') || 'N/A',
          publicUrl: this.configService.get<string>('publicUrl') || 'N/A',
          port: this.configService.get<number>('port') || 3001,
        },
      },
    };
  }
}
