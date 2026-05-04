import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { TemplateService } from './template.service';
import {
  STORAGE_PATHS,
  sanitizeFilename,
} from '../../common/utils/storage-paths';

@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * GET /templates
   * List all templates with metadata
   */
  @Get()
  @ApiOperation({ summary: 'Listar todos los templates con metadatos' })
  @ApiResponse({ status: 200, description: 'Lista de templates' })
  listTemplates() {
    const templates = this.templateService.listTemplatesWithMetadata();

    return {
      success: true,
      data: {
        templates: templates,
        count: templates.length,
        summary: {
          totalTemplates: templates.length,
          supportedFormats: templates.filter((t) => t.isSupported).length,
          totalSize: templates.reduce((sum, t) => sum + t.size, 0),
          lastModified: templates.length > 0 ? templates[0].modifiedAt : null,
        },
      },
    };
  }

  /**
   * POST /templates/upload
   * Upload new template
   */
  @Post('upload')
  @ApiOperation({ summary: 'Subir nuevo template' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Template subido correctamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido' })
  @UseInterceptors(
    FileInterceptor('template', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, STORAGE_PATHS.templates);
        },
        filename: (req, file, cb) => {
          cb(null, sanitizeFilename(file.originalname));
        },
      }),
      fileFilter: (req, file, cb) => {
        const validExtensions = ['.docx', '.odt', '.html', '.xlsx', '.ods'];
        const fileExtension = extname(file.originalname).toLowerCase();

        if (validExtensions.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Formato de archivo no soportado. Use: ${validExtensions.join(', ')}`,
            ) as any,
            false,
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  uploadTemplate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No se proporcionó ningún archivo de template',
      );
    }

    const templateInfo = this.templateService.getTemplateInfo(file.filename);

    return {
      success: true,
      data: {
        message: 'Template subido correctamente',
        template: {
          name: templateInfo.name,
          id: templateInfo.id,
          size: templateInfo.sizeFormatted,
          extension: templateInfo.extension,
        },
      },
    };
  }

  /**
   * DELETE /templates/:id
   * Delete template by ID
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar template por ID' })
  @ApiParam({
    name: 'id',
    description: 'ID del template (nombre con o sin extensión)',
  })
  @ApiResponse({ status: 200, description: 'Template eliminado' })
  @ApiResponse({ status: 404, description: 'Template no encontrado' })
  deleteTemplate(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('ID del template es requerido');
    }

    if (!this.templateService.templateExists(id)) {
      throw new NotFoundException(`Template con ID '${id}' no encontrado`);
    }

    // Get info before deleting
    const templates = this.templateService.listTemplatesWithMetadata();
    const templateInfo = templates.find((t) => t.id === id || t.name === id);

    this.templateService.deleteTemplate(id);

    return {
      success: true,
      data: {
        message: `Template '${templateInfo?.name || id}' eliminado correctamente`,
        deletedTemplate: {
          id: templateInfo?.id || id,
          name: templateInfo?.name || id,
          size: templateInfo?.sizeFormatted || 'N/A',
          deletedAt: new Date().toISOString(),
        },
      },
    };
  }
}
