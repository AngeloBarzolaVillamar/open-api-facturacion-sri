import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ImageService } from './image.service';
import { formatFileSize } from '../../common/utils/file.utils';
import {
  STORAGE_PATHS,
  sanitizeFilename,
} from '../../common/utils/storage-paths';

@ApiTags('Images')
@Controller('images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /**
   * POST /images/upload
   * Upload an image
   */
  @Post('upload')
  @ApiOperation({ summary: 'Subir una imagen' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagen subida' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, STORAGE_PATHS.pdfsImages);
        },
        filename: (req, file, cb) => {
          // Generate unique name with timestamp and sanitize
          const uniqueName = `${Date.now()}_${sanitizeFilename(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp',
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes (PNG, JPEG, GIF, WEBP)',
            ) as any,
            false,
          );
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ninguna imagen');
    }

    const fileUrl = this.imageService.buildImageUrl(file.filename);

    return {
      success: true,
      data: {
        message: 'Imagen subida correctamente',
        fileName: file.filename,
        fileUrl: fileUrl,
        size: formatFileSize(file.size),
        mimetype: file.mimetype,
      },
    };
  }

  /**
   * GET /images/list
   * List all images
   */
  @Get('list')
  @ApiOperation({ summary: 'Listar todas las imágenes' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Elementos por página',
  })
  @ApiResponse({ status: 200, description: 'Lista de imágenes' })
  listImages(@Query('page') page?: string, @Query('limit') limit?: string) {
    const options: { page?: number; limit?: number } = {};
    if (page) options.page = parseInt(page);
    if (limit) options.limit = parseInt(limit);

    const result = this.imageService.listImages(options);

    return {
      success: true,
      data: {
        images: result.images,
        total: result.total,
        pagination: result.pagination,
      },
    };
  }

  /**
   * DELETE /images/:fileName
   * Delete an image
   */
  @Delete(':fileName')
  @ApiOperation({ summary: 'Eliminar una imagen' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada' })
  deleteImage(@Param('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('Nombre de archivo es requerido');
    }

    this.imageService.deleteImage(fileName);

    return {
      success: true,
      data: {
        message: `Imagen ${fileName} eliminada correctamente`,
      },
    };
  }
}
