import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  existsSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import { join, basename } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import { TemplateService } from '../template/template.service';
import {
  GeneratePdfDto,
  GeneratePdfWithImagesDto,
} from './dto/generate-pdf.dto';
import { formatFileSize } from '../../common/utils/file.utils';
import {
  STORAGE_PATHS,
  sanitizeFilename,
} from '../../common/utils/storage-paths';

@ApiTags('Generate PDF')
@Controller('generate-pdf')
export class PdfController {
  private readonly publicUrl: string;

  constructor(
    private readonly pdfService: PdfService,
    private readonly templateService: TemplateService,
    private readonly configService: ConfigService,
  ) {
    this.publicUrl = this.configService.get<string>('publicUrl')!;
  }

  /**
   * POST /generate-pdf/download/:templateId
   * Generate PDF and download
   */
  @Post('download/:templateId')
  @ApiOperation({ summary: 'Generar PDF y descargarlo' })
  @ApiParam({
    name: 'templateId',
    required: true,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 200, description: 'PDF generado' })
  async generatePdfAndDownload(
    @Param('templateId') templateId: string,
    @Body() body: GeneratePdfDto | Record<string, unknown>,
    @Res() res: Response,
  ) {
    // Support both { jsonData: {...} } and direct data format
    const jsonData = (body as GeneratePdfDto).jsonData || body;

    if (!jsonData || Object.keys(jsonData).length === 0) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDF(
      jsonData as Record<string, unknown>,
      templatePath,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=documento.pdf');
    return res.send(pdfBuffer);
  }

  /**
   * POST /generate-pdf/save/:templateId
   * Generate PDF, save and return link
   */
  @Post('save/:templateId')
  @ApiOperation({ summary: 'Generar PDF, guardar y devolver link' })
  @ApiParam({
    name: 'templateId',
    required: true,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 201, description: 'PDF generado y guardado' })
  async generatePdfAndSave(
    @Param('templateId') templateId: string,
    @Body() body: GeneratePdfDto | Record<string, unknown>,
  ) {
    const jsonData = (body as GeneratePdfDto).jsonData || body;

    if (!jsonData || Object.keys(jsonData).length === 0) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDF(
      jsonData as Record<string, unknown>,
      templatePath,
    );

    // Generate unique filename
    const fileName = `documento_${Date.now()}.pdf`;
    const filePath = join(STORAGE_PATHS.pdfsOthers, fileName);

    // Save the PDF
    writeFileSync(filePath, pdfBuffer);

    // Build file URL
    const fileUrl = `${this.publicUrl}/pdfs/others/${fileName}`;

    return {
      success: true,
      data: {
        message: 'PDF generado correctamente',
        fileName: fileName,
        fileUrl: fileUrl,
        fileSize: Buffer.byteLength(pdfBuffer),
        templateUsed: basename(templatePath),
      },
    };
  }

  /**
   * POST /generate-pdf/with-images/download/:templateId
   * Generate PDF with images and download
   */
  @Post('with-images/download/:templateId')
  @ApiOperation({ summary: 'Generar PDF con imágenes y descargarlo' })
  @ApiParam({
    name: 'templateId',
    required: true,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 200, description: 'PDF con imágenes generado' })
  async generatePdfWithImagesAndDownload(
    @Param('templateId') templateId: string,
    @Body() body: GeneratePdfWithImagesDto,
    @Res() res: Response,
  ) {
    const { jsonData, images } = body;

    if (!jsonData) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    if (images && !Array.isArray(images)) {
      throw new BadRequestException(
        'El formato de imágenes es inválido. Debe ser un array.',
      );
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDFWithImages(
      jsonData,
      templatePath,
      images,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=documento_con_imagenes.pdf',
    );
    return res.send(pdfBuffer);
  }

  /**
   * POST /generate-pdf/with-images/save/:templateId
   * Generate PDF with images, save and return link
   */
  @Post('with-images/save/:templateId')
  @ApiOperation({
    summary: 'Generar PDF con imágenes, guardar y devolver link',
  })
  @ApiParam({
    name: 'templateId',
    required: true,
    description: 'ID del template',
  })
  @SwaggerResponse({ status: 201, description: 'PDF con imágenes guardado' })
  async generatePdfWithImagesAndSave(
    @Param('templateId') templateId: string,
    @Body() body: GeneratePdfWithImagesDto,
  ) {
    const { jsonData, images } = body;

    if (!jsonData) {
      throw new BadRequestException('No se proporcionaron datos JSON');
    }

    if (images && !Array.isArray(images)) {
      throw new BadRequestException(
        'El formato de imágenes es inválido. Debe ser un array.',
      );
    }

    const templatePath = this.templateService.findTemplate(templateId);
    const pdfBuffer = await this.pdfService.generatePDFWithImages(
      jsonData,
      templatePath,
      images,
    );

    // Generate unique filename
    const fileName = `documento_con_imagenes_${Date.now()}.pdf`;
    const filePath = join(STORAGE_PATHS.pdfsOthers, fileName);

    // Save the PDF
    writeFileSync(filePath, pdfBuffer);

    // Build file URL
    const fileUrl = `${this.publicUrl}/pdfs/others/${fileName}`;

    return {
      success: true,
      data: {
        message: 'PDF con imágenes generado correctamente',
        fileName: fileName,
        fileUrl: fileUrl,
        fileSize: Buffer.byteLength(pdfBuffer),
        templateUsed: basename(templatePath),
        imagesAdded: images ? images.length : 0,
      },
    };
  }

  /**
   * GET /generate-pdf/list/:type
   * List PDFs by type
   */
  @Get('list/:type')
  @ApiOperation({ summary: 'Listar PDFs por tipo' })
  @ApiParam({
    name: 'type',
    enum: ['con_firma', 'others', 'documents'],
    description: 'Tipo de PDFs',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Elementos por página',
  })
  @SwaggerResponse({ status: 200, description: 'Lista de PDFs' })
  listPdfs(
    @Param('type') type: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const validTypes = ['con_firma', 'others', 'documents'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Tipo inválido. Use: ${validTypes.join(', ')}`,
      );
    }

    const pdfDirPath = join(STORAGE_PATHS.pdfs, type);

    // Check if directory exists
    if (!existsSync(pdfDirPath)) {
      return {
        success: true,
        data: {
          files: [],
          total: 0,
          pagination: null,
        },
      };
    }

    // Read and map files
    const allFiles = readdirSync(pdfDirPath)
      .filter((file) => {
        if (type === 'documents') {
          return statSync(join(pdfDirPath, file)).isFile();
        }
        return file.toLowerCase().endsWith('.pdf');
      })
      .map((file) => {
        const stats = statSync(join(pdfDirPath, file));
        return {
          name: file,
          size: formatFileSize(stats.size),
          createdAt: stats.birthtime,
          fileUrl: `${this.publicUrl}/pdfs/${type}/${file}`,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const total = allFiles.length;

    // If no pagination, return all
    if (!page && !limit) {
      return {
        success: true,
        data: {
          files: allFiles,
          total: total,
          pagination: null,
        },
      };
    }

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '10') || 10));
    const totalPages = Math.ceil(total / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginatedFiles = allFiles.slice(offset, offset + limitNum);

    return {
      success: true,
      data: {
        files: paginatedFiles,
        total: total,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages: totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    };
  }

  /**
   * POST /generate-pdf/upload/:type
   * Upload a PDF
   */
  @Post('upload/:type')
  @ApiOperation({ summary: 'Subir un PDF' })
  @ApiParam({
    name: 'type',
    enum: ['con_firma', 'others'],
    description: 'Tipo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pdf: { type: 'string', format: 'binary' },
      },
    },
  })
  @SwaggerResponse({ status: 201, description: 'PDF subido' })
  @UseInterceptors(
    FileInterceptor('pdf', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const type = req.params.type;
          const validTypes = ['con_firma', 'others'];
          if (!validTypes.includes(type)) {
            return cb(new Error('Tipo inválido'), '');
          }
          const destDir =
            type === 'con_firma'
              ? STORAGE_PATHS.pdfsConFirma
              : STORAGE_PATHS.pdfsOthers;
          cb(null, destDir);
        },
        filename: (req, file, cb) => {
          cb(null, sanitizeFilename(file.originalname));
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Solo se permiten archivos PDF') as any,
            false,
          );
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  uploadPdf(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const validTypes = ['con_firma', 'others'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Tipo inválido. Use: ${validTypes.join(', ')}`,
      );
    }

    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo PDF');
    }

    const fileUrl = `${this.publicUrl}/pdfs/${type}/${file.filename}`;

    return {
      success: true,
      data: {
        message: 'PDF subido correctamente',
        fileName: file.filename,
        fileUrl: fileUrl,
        size: formatFileSize(file.size),
        uploadedTo: type,
      },
    };
  }

  /**
   * DELETE /generate-pdf/:type/:fileName
   * Delete a PDF
   */
  @Delete(':type/:fileName')
  @ApiOperation({ summary: 'Eliminar un PDF' })
  @ApiParam({
    name: 'type',
    enum: ['con_firma', 'others', 'documents'],
    description: 'Tipo',
  })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @SwaggerResponse({ status: 200, description: 'PDF eliminado' })
  deletePdf(@Param('type') type: string, @Param('fileName') fileName: string) {
    const validTypes = ['con_firma', 'others', 'documents'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Tipo inválido. Use: ${validTypes.join(', ')}`,
      );
    }

    if (!fileName) {
      throw new BadRequestException('Nombre de archivo es requerido');
    }

    if (type !== 'documents' && !fileName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException(
        'Nombre de archivo inválido. Debe terminar en .pdf',
      );
    }

    const filePath = join(STORAGE_PATHS.pdfs, type, fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `Archivo ${fileName} no encontrado en ${type}`,
      );
    }

    // Delete file
    unlinkSync(filePath);

    return {
      success: true,
      data: {
        message: `PDF ${fileName} eliminado correctamente`,
        deletedFrom: type,
      },
    };
  }
}
