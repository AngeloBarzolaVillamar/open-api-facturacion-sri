import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Headers,
  Query,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import {
  DocumentService,
  SUPPORTED_FORMATS,
  MIME_TYPES,
} from './document.service';
import { TemplateService } from '../template/template.service';
import { formatFileSize } from '../../common/utils/file.utils';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  private readonly publicUrl: string;

  constructor(
    private readonly documentService: DocumentService,
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
   * Get output format from: header X-Output-Format, query ?format= or body.format
   * Priority: header > query > body
   */
  private getOutputFormat(
    headerFormat?: string,
    queryFormat?: string,
    bodyFormat?: string,
  ): string | null {
    return headerFormat || queryFormat || bodyFormat || null;
  }

  /**
   * GET /documents/formats
   * Get list of supported formats
   */
  @Get('formats')
  @ApiOperation({ summary: 'Obtener formatos soportados' })
  @SwaggerResponse({ status: 200, description: 'Lista de formatos' })
  getSupportedFormats() {
    return {
      success: true,
      data: {
        formats: SUPPORTED_FORMATS,
        mimeTypes: MIME_TYPES,
      },
    };
  }

  /**
   * POST /documents/download/:templateId
   * Generate document in specific format and download
   */
  @Post('download/:templateId')
  @ApiOperation({ summary: 'Generar documento y descargarlo' })
  @ApiParam({
    name: 'templateId',
    required: false,
    description: 'ID del template',
  })
  @ApiHeader({
    name: 'X-Output-Format',
    required: false,
    description: 'Formato de salida (xlsx, pdf, docx, etc.)',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Formato de salida',
  })
  @SwaggerResponse({ status: 200, description: 'Documento generado' })
  async generateDocumentAndDownload(
    @Param('templateId') templateId: string,
    @Body() body: any,
    @Res() res: Response,
    @Headers('x-output-format') headerFormat?: string,
    @Query('format') queryFormat?: string,
  ) {
    const format = this.getOutputFormat(
      headerFormat,
      queryFormat,
      body?.format,
    );

    // Data can come directly in body or in body.jsonData
    const jsonData = body.jsonData || body;

    if (!jsonData || Object.keys(jsonData).length === 0) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    if (!format) {
      throw new BadRequestException(
        `No se especificó el formato. Use header X-Output-Format, query ?format= o body.format. Formatos: ${SUPPORTED_FORMATS.join(', ')}`,
      );
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const docBuffer = await this.documentService.generateDocument(
      jsonData,
      templatePath,
      format,
    );
    const mimeType = this.documentService.getMimeType(format);
    const fileName = `documento.${format.toLowerCase()}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return res.send(docBuffer);
  }

  /**
   * POST /documents/save/:templateId
   * Generate document in specific format, save and return link
   */
  @Post('save/:templateId')
  @ApiOperation({ summary: 'Generar documento, guardar y devolver link' })
  @ApiParam({
    name: 'templateId',
    required: false,
    description: 'ID del template',
  })
  @ApiHeader({
    name: 'X-Output-Format',
    required: false,
    description: 'Formato de salida',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Formato de salida',
  })
  @SwaggerResponse({ status: 201, description: 'Documento guardado' })
  async generateDocumentAndSave(
    @Param('templateId') templateId: string,
    @Body() body: any,
    @Headers('x-output-format') headerFormat?: string,
    @Query('format') queryFormat?: string,
  ) {
    const format = this.getOutputFormat(
      headerFormat,
      queryFormat,
      body?.format,
    );

    // Data can come directly in body or in body.jsonData
    const jsonData = body.jsonData || body;

    if (!jsonData || Object.keys(jsonData).length === 0) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    if (!format) {
      throw new BadRequestException(
        `No se especificó el formato. Use header X-Output-Format, query ?format= o body.format. Formatos: ${SUPPORTED_FORMATS.join(', ')}`,
      );
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const docBuffer = await this.documentService.generateDocument(
      jsonData,
      templatePath,
      format,
    );

    // Create documents directory if not exists
    const docsDir = join(this.pdfDir, 'documents');
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Generate unique filename
    const fileName = `documento_${Date.now()}.${format.toLowerCase()}`;
    const filePath = join(docsDir, fileName);

    // Save document
    writeFileSync(filePath, docBuffer);

    // Build file URL
    const fileUrl = `${this.publicUrl}/pdfs/documents/${fileName}`;

    return {
      success: true,
      data: {
        message: 'Documento generado correctamente',
        fileName: fileName,
        fileUrl: fileUrl,
        format: format.toLowerCase(),
        fileSize: formatFileSize(Buffer.byteLength(docBuffer)),
        templateUsed: basename(templatePath),
      },
    };
  }
}
