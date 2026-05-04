import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { PdfImageService } from './pdf-image.service';

export interface ImageData {
  url: string;
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly carboneApi: string;
  private readonly pdfRenderConfig: {
    maxAttempts: number;
    retryDelay: number;
  };
  private readonly carboneRenderOptions: Record<string, unknown>;

  constructor(
    private configService: ConfigService,
    private pdfImageService: PdfImageService,
  ) {
    this.carboneApi = this.configService.get<string>('carboneApi')!;
    this.pdfRenderConfig = {
      maxAttempts: this.configService.get<number>('pdfRender.maxAttempts') || 2,
      retryDelay: this.configService.get<number>('pdfRender.retryDelay') || 10,
    };
    this.carboneRenderOptions =
      this.configService.get('carboneRenderOptions') || {};
  }

  /**
   * Generate a PDF using the Carbone API
   */
  async generatePDF(
    jsonData: Record<string, unknown>,
    templatePath: string,
  ): Promise<Buffer> {
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

    // 2. Render PDF
    const renderResponse = await axios.post(
      `${this.carboneApi}/render/${templateId}`,
      {
        data: jsonData,
        ...this.carboneRenderOptions,
      },
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
        // 4. Download the PDF
        const pdfResponse = await axios.get(
          `${this.carboneApi}/render/${renderId}`,
          { responseType: 'arraybuffer' },
        );

        return Buffer.from(pdfResponse.data);
      }

      attempts++;
      await new Promise((resolve) =>
        setTimeout(resolve, this.pdfRenderConfig.retryDelay),
      );
    }

    throw new Error('Tiempo de espera agotado');
  }

  /**
   * Generate a PDF with images using post-processing
   */
  async generatePDFWithImages(
    jsonData: Record<string, unknown>,
    templatePath: string,
    images?: ImageData[],
  ): Promise<Buffer> {
    try {
      // 1. Generate base PDF using Carbone
      const pdfBuffer = await this.generatePDF(jsonData, templatePath);

      // 2. Add images if provided
      if (!images || images.length === 0) {
        return pdfBuffer;
      }

      // 3. Process PDF to add images
      return await this.pdfImageService.addImagesToPdf(pdfBuffer, images);
    } catch (error) {
      this.logger.error('Error al generar PDF con imágenes:', error);
      throw error;
    }
  }
}
