import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { basename } from 'path';

/**
 * Supported output formats by Carbone.io
 */
export const SUPPORTED_FORMATS = [
  'pdf',
  'docx',
  'doc',
  'odt',
  'rtf',
  'txt',
  'xlsx',
  'xls',
  'ods',
  'csv',
  'pptx',
  'ppt',
  'odp',
  'html',
  'xml',
  'json',
];

/**
 * MIME types for Content-Type
 */
export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  odp: 'application/vnd.oasis.opendocument.presentation',
  html: 'text/html',
  xml: 'application/xml',
  json: 'application/json',
};

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly carboneApi: string;
  private readonly pdfRenderConfig: {
    maxAttempts: number;
    retryDelay: number;
  };
  private readonly carboneRenderOptions: Record<string, unknown>;

  constructor(private configService: ConfigService) {
    this.carboneApi = this.configService.get<string>('carboneApi')!;
    this.pdfRenderConfig = {
      maxAttempts: this.configService.get<number>('pdfRender.maxAttempts') || 2,
      retryDelay: this.configService.get<number>('pdfRender.retryDelay') || 10,
    };
    this.carboneRenderOptions =
      this.configService.get('carboneRenderOptions') || {};
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return SUPPORTED_FORMATS;
  }

  /**
   * Get MIME types
   */
  getMimeTypes(): Record<string, string> {
    return MIME_TYPES;
  }

  /**
   * Get MIME type for a format
   */
  getMimeType(format: string): string {
    return MIME_TYPES[format.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Generate a document in the specified format using Carbone API
   */
  async generateDocument(
    jsonData: Record<string, unknown>,
    templatePath: string,
    outputFormat: string,
  ): Promise<Buffer> {
    // Validate format
    const format = outputFormat.toLowerCase();
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new BadRequestException(
        `Formato '${outputFormat}' no soportado. Use: ${SUPPORTED_FORMATS.join(', ')}`,
      );
    }

    // 1. Upload template to Carbone
    const formData = new FormData();
    const templateStream = createReadStream(templatePath);
    formData.append('template', templateStream, {
      filename: basename(templatePath),
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const templateResponse = await axios.post(
      `${this.carboneApi}/template`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Accept: 'application/json',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    if (
      !templateResponse.data?.success ||
      !templateResponse.data?.data?.templateId
    ) {
      throw new Error('Error al obtener el ID del template');
    }

    const templateId = templateResponse.data.data.templateId;

    // 2. Render document with custom format
    const renderOptions = {
      data: jsonData,
      complement: {},
      enum: {},
      translations: {},
      isDebugActive: (this.carboneRenderOptions as any)?.isDebugActive || false,
      convertTo: format, // Use specified format
      lang: (this.carboneRenderOptions as any)?.lang || 'en-US',
    };

    const renderResponse = await axios.post(
      `${this.carboneApi}/render/${templateId}`,
      renderOptions,
    );

    if (!renderResponse.data?.success || !renderResponse.data?.data?.renderId) {
      throw new Error('Error al iniciar el renderizado');
    }

    const renderId = renderResponse.data.data.renderId;

    // 3. Wait and check status
    let attempts = 0;
    const maxAttempts = this.pdfRenderConfig.maxAttempts;

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(`${this.carboneApi}/status`);

      if (statusResponse.data.success || statusResponse.data.ready) {
        // 4. Download the document
        const docResponse = await axios.get(
          `${this.carboneApi}/render/${renderId}`,
          { responseType: 'arraybuffer' },
        );

        return Buffer.from(docResponse.data);
      }

      attempts++;
      await new Promise((resolve) =>
        setTimeout(resolve, this.pdfRenderConfig.retryDelay),
      );
    }

    throw new Error('Tiempo de espera agotado');
  }
}
