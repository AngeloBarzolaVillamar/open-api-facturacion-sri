import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { extname } from 'path';
import { join } from 'path';
import { formatFileSize } from '../../common/utils/file.utils';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

export interface ImageInfo {
  name: string;
  size: string;
  createdAt: Date;
  fileUrl: string;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly publicUrl: string;
  private readonly validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

  constructor(private configService: ConfigService) {
    this.publicUrl = this.configService.get<string>('publicUrl')!;
  }

  /**
   * Get images directory path
   */
  getImagesDir(): string {
    return STORAGE_PATHS.pdfsImages;
  }

  /**
   * List all images with optional pagination
   */
  listImages(options: { page?: number; limit?: number } = {}): {
    images: ImageInfo[];
    total: number;
    pagination: any;
  } {
    const imagesDir = this.getImagesDir();

    if (!existsSync(imagesDir)) {
      return {
        images: [],
        total: 0,
        pagination: null,
      };
    }

    const allImages = readdirSync(imagesDir)
      .filter((file) => {
        const ext = extname(file).toLowerCase();
        return this.validExtensions.includes(ext);
      })
      .map((file) => {
        const stats = statSync(join(imagesDir, file));
        return {
          name: file,
          size: formatFileSize(stats.size),
          createdAt: stats.birthtime,
          fileUrl: `${this.publicUrl}/images/${file}`,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const total = allImages.length;

    // Without pagination
    if (!options.page && !options.limit) {
      return {
        images: allImages,
        total: total,
        pagination: null,
      };
    }

    // With pagination
    const pageNum = Math.max(1, parseInt(String(options.page)) || 1);
    const limitNum = Math.max(
      1,
      Math.min(100, parseInt(String(options.limit)) || 10),
    );
    const totalPages = Math.ceil(total / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginatedImages = allImages.slice(offset, offset + limitNum);

    return {
      images: paginatedImages,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * Delete an image
   */
  deleteImage(fileName: string): boolean {
    const filePath = join(this.getImagesDir(), fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Imagen ${fileName} no encontrada`);
    }

    unlinkSync(filePath);
    this.logger.log(`Imagen eliminada: ${fileName}`);
    return true;
  }

  /**
   * Build image URL
   */
  buildImageUrl(fileName: string): string {
    return `${this.publicUrl}/images/${fileName}`;
  }
}
