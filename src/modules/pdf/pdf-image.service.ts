import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';

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
export class PdfImageService {
  private readonly logger = new Logger(PdfImageService.name);

  /**
   * Add images to an existing PDF
   */
  async addImagesToPdf(
    pdfBuffer: Buffer,
    imageData: ImageData[],
  ): Promise<Buffer> {
    try {
      // Log received data for debugging
      this.logger.log(
        `Recibidas ${imageData?.length || 0} imágenes para procesar`,
      );
      if (imageData && imageData.length > 0) {
        imageData.forEach((img, index) => {
          this.logger.log(
            `Imagen ${index}: url=${img.url}, page=${img.page}, x=${img.x}, y=${img.y}`,
          );
        });
      }

      // If no images to add, return original PDF
      if (!imageData || imageData.length === 0) {
        return pdfBuffer;
      }

      // Load the PDF for modification
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      // Process each image
      for (const image of imageData) {
        try {
          // Verify required image info
          if (!image.url) {
            this.logger.warn(
              `Se omitió una imagen sin URL. Datos recibidos: ${JSON.stringify(image)}`,
            );
            continue;
          }

          // Page where image will be inserted (0 = first page)
          const pageIndex = typeof image.page === 'number' ? image.page : 0;

          // Verify page exists
          if (pageIndex < 0 || pageIndex >= pages.length) {
            this.logger.warn(
              `Página ${pageIndex} no existe en el PDF. El PDF tiene ${pages.length} páginas.`,
            );
            continue;
          }

          const page = pages[pageIndex];

          // Set default positions and dimensions
          const x = typeof image.x === 'number' ? image.x : 0;
          const y = typeof image.y === 'number' ? image.y : 0;
          const width = typeof image.width === 'number' ? image.width : 100;
          const height = typeof image.height === 'number' ? image.height : 100;
          const opacity = typeof image.opacity === 'number' ? image.opacity : 1;

          // Get image bytes
          let imageBytes: Buffer;
          if (
            image.url.startsWith('http://') ||
            image.url.startsWith('https://')
          ) {
            // Get image from URL
            const response = await axios.get(image.url, {
              responseType: 'arraybuffer',
            });
            imageBytes = Buffer.from(response.data);
          } else {
            // Get image from local file
            const imagePath =
              image.url.startsWith('/') || image.url.includes(':')
                ? image.url // Absolute path
                : join(process.cwd(), image.url); // Relative path

            if (!existsSync(imagePath)) {
              this.logger.warn(`Imagen no encontrada: ${imagePath}`);
              continue;
            }

            imageBytes = readFileSync(imagePath);
          }

          // Embed image based on format
          let embeddedImage;
          const imageUrl = image.url.toLowerCase();

          if (imageUrl.endsWith('.png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            this.logger.warn(
              `Formato de imagen no soportado: ${image.url}. Solo se permiten JPG y PNG.`,
            );
            continue;
          }

          // Draw image on page
          page.drawImage(embeddedImage, {
            x,
            y,
            width,
            height,
            opacity,
          });
        } catch (error) {
          this.logger.error(`Error al procesar imagen ${image.url}:`, error);
          // Continue with other images if one fails
        }
      }

      // Save modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    } catch (error) {
      this.logger.error('Error al añadir imágenes al PDF:', error);
      throw new Error(
        'No se pudieron añadir las imágenes al PDF: ' + error.message,
      );
    }
  }
}
