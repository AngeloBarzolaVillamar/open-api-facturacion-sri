import {
  Controller,
  Post,
  Param,
  Body,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SignatureService } from './signature.service';
import { CertificateService } from '../certificate/certificate.service';
import { PdfService } from '../pdf/pdf.service';
import { TemplateService } from '../template/template.service';
import { SignPdfDto, GenerateAndSignPdfDto } from './dto/signature.dto';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

@ApiTags('Signature')
@Controller('signature')
export class SignatureController {
  private readonly publicUrl: string;

  constructor(
    private readonly signatureService: SignatureService,
    private readonly certificateService: CertificateService,
    private readonly pdfService: PdfService,
    private readonly templateService: TemplateService,
    private readonly configService: ConfigService,
  ) {
    this.publicUrl = this.configService.get<string>('publicUrl')!;
  }

  /**
   * Get PDF directory from STORAGE_PATHS
   */
  private get pdfDir(): string {
    return STORAGE_PATHS.pdfs;
  }

  /**
   * POST /signature/sign-pdf/:fileName
   * Sign an existing PDF
   */
  @Post('sign-pdf/:fileName')
  @ApiOperation({ summary: 'Firmar un PDF existente' })
  @ApiParam({
    name: 'fileName',
    description: 'Nombre del archivo PDF a firmar',
  })
  @SwaggerResponse({ status: 200, description: 'PDF firmado correctamente' })
  async signExistingPdf(
    @Param('fileName') fileName: string,
    @Body() body: SignPdfDto,
  ) {
    const { certFile, password, position } = body;

    if (!certFile || !password) {
      throw new BadRequestException(
        'Se requiere el archivo de certificado y la contraseña',
      );
    }

    // Validate certificate exists and is not expired
    try {
      const validation = this.certificateService.validateCertificateExpiry(
        certFile,
        password,
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: `No se puede firmar: ${validation.reason}`,
          validationDetails: {
            isExpired: validation.isExpired,
            isNotYetValid: validation.isNotYetValid,
            expiryDate: validation.expiryDate,
            startDate: validation.startDate,
            subject: validation.subject,
          },
        });
      }

      // Log warning if certificate expires soon
      if (validation.warning) {
        console.warn(`ADVERTENCIA: ${validation.warning}`);
      }
    } catch (certError) {
      if (certError instanceof BadRequestException) {
        throw certError;
      }
      throw new BadRequestException(
        `Error al validar el certificado: ${(certError as Error).message}. Verifique que el archivo existe y la contraseña es correcta.`,
      );
    }

    // Search first in 'others' folder
    let pdfPath = join(this.pdfDir, 'others', fileName);

    // If not in others, search in root for compatibility
    if (!existsSync(pdfPath)) {
      pdfPath = join(this.pdfDir, fileName);
      if (!existsSync(pdfPath)) {
        throw new NotFoundException('Archivo PDF no encontrado');
      }
    }

    // Read PDF
    const pdfBuffer = readFileSync(pdfPath);

    // Sign PDF with optional position
    const signedPdfBuffer = await this.signatureService.signPDF(
      pdfBuffer,
      certFile,
      password,
      position || {},
    );

    // Save signed PDF
    const signedFileName = `signed_${fileName}`;
    const signedDir = join(this.pdfDir, 'con_firma');

    if (!existsSync(signedDir)) {
      mkdirSync(signedDir, { recursive: true });
    }

    const signedFilePath = join(signedDir, signedFileName);
    writeFileSync(signedFilePath, signedPdfBuffer);

    // Build file URL
    const fileUrl = `${this.publicUrl}/pdfs/con_firma/${signedFileName}`;

    return {
      success: true,
      data: {
        message: 'PDF firmado correctamente',
        fileName: signedFileName,
        fileUrl: fileUrl,
        fileSize: Buffer.byteLength(signedPdfBuffer),
        originalFile: fileName,
      },
    };
  }

  /**
   * POST /signature/generate-sign-pdf/:templateId
   * Generate and sign PDF in one step
   */
  @Post('generate-sign-pdf/:templateId')
  @ApiOperation({ summary: 'Generar y firmar PDF en un solo paso' })
  @ApiParam({
    name: 'templateId',
    required: false,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 200, description: 'PDF generado y firmado' })
  async generateAndSignPdf(
    @Param('templateId') templateId: string,
    @Body() body: GenerateAndSignPdfDto,
  ) {
    const { jsonData, certFile, password, position } = body;

    if (!jsonData) {
      throw new BadRequestException(
        'No se proporcionaron datos JSON para la generación del documento',
      );
    }

    if (!certFile || !password) {
      throw new BadRequestException(
        'Se requiere el archivo de certificado y la contraseña para la firma',
      );
    }

    // Validate certificate
    try {
      const validation = this.certificateService.validateCertificateExpiry(
        certFile,
        password,
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: `No se puede firmar: ${validation.reason}`,
          validationDetails: {
            isExpired: validation.isExpired,
            isNotYetValid: validation.isNotYetValid,
            expiryDate: validation.expiryDate,
            startDate: validation.startDate,
            subject: validation.subject,
          },
        });
      }

      if (validation.warning) {
        console.warn(`ADVERTENCIA: ${validation.warning}`);
      }
    } catch (certError) {
      if (certError instanceof BadRequestException) {
        throw certError;
      }
      throw new BadRequestException(
        `Error al validar el certificado: ${(certError as Error).message}. Verifique que el archivo existe y la contraseña es correcta.`,
      );
    }

    // Step 1: Generate PDF
    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDF(jsonData, templatePath);

    // Generate unique filename
    const now = new Date();
    const fileName = `documento_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.pdf`;

    // Ensure signed directory exists
    const signedDir = join(this.pdfDir, 'con_firma');
    if (!existsSync(signedDir)) {
      mkdirSync(signedDir, { recursive: true });
    }

    // Step 2: Sign PDF
    const signedPdfBuffer = await this.signatureService.signPDF(
      pdfBuffer,
      certFile,
      password,
      position || {},
    );

    // Save signed PDF
    const signedFileName = `signed_${fileName}`;
    const signedFilePath = join(signedDir, signedFileName);
    writeFileSync(signedFilePath, signedPdfBuffer);

    // Build file URL
    const signedFileUrl = `${this.publicUrl}/pdfs/con_firma/${signedFileName}`;

    return {
      success: true,
      data: {
        message: 'PDF generado y firmado correctamente',
        signedFile: {
          fileName: signedFileName,
          fileUrl: signedFileUrl,
          fileSize: Buffer.byteLength(signedPdfBuffer),
        },
        templateUsed: basename(templatePath),
      },
    };
  }

  /**
   * POST /signature/generate-sign-pdf/download/:templateId
   * Generate and sign PDF with direct download
   */
  @Post('generate-sign-pdf/download/:templateId')
  @ApiOperation({ summary: 'Generar y firmar PDF con descarga directa' })
  @ApiParam({
    name: 'templateId',
    required: false,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 200, description: 'PDF firmado descargado' })
  async generateAndSignPdfDownload(
    @Param('templateId') templateId: string,
    @Body() body: GenerateAndSignPdfDto,
    @Res() res: Response,
  ) {
    const { jsonData, certFile, password, position } = body;

    if (!jsonData) {
      throw new BadRequestException(
        'No se proporcionaron datos JSON para la generación del documento',
      );
    }

    if (!certFile || !password) {
      throw new BadRequestException(
        'Se requiere el archivo de certificado y la contraseña para la firma',
      );
    }

    // Validate certificate
    try {
      const validation = this.certificateService.validateCertificateExpiry(
        certFile,
        password,
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: `No se puede firmar: ${validation.reason}`,
          validationDetails: {
            isExpired: validation.isExpired,
            isNotYetValid: validation.isNotYetValid,
            expiryDate: validation.expiryDate,
            startDate: validation.startDate,
            subject: validation.subject,
          },
        });
      }

      if (validation.warning) {
        console.warn(`ADVERTENCIA: ${validation.warning}`);
      }
    } catch (certError) {
      if (certError instanceof BadRequestException) {
        throw certError;
      }
      throw new BadRequestException(
        `Error al validar el certificado: ${(certError as Error).message}. Verifique que el archivo existe y la contraseña es correcta.`,
      );
    }

    // Generate PDF
    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDF(jsonData, templatePath);

    // Sign PDF
    const signedPdfBuffer = await this.signatureService.signPDF(
      pdfBuffer,
      certFile,
      password,
      position || {},
    );

    // Set headers and send as download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=documento_firmado.pdf',
    );
    return res.send(signedPdfBuffer);
  }
}
