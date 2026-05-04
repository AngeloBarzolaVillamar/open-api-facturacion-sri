import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from 'fs';
import { join, extname, parse } from 'path';
import { formatFileSize } from '../../common/utils/file.utils';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

export interface TemplateInfo {
  name: string;
  id: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  documentType: string;
  createdAt: Date;
  modifiedAt: Date;
  isSupported: boolean;
  path: string;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly supportedFormats = [
    '.docx',
    '.odt',
    '.html',
    '.xlsx',
    '.ods',
  ];

  /**
   * Get templates directory from STORAGE_PATHS
   */
  private get templatesDir(): string {
    return STORAGE_PATHS.templates;
  }

  /**
   * Ensure template directory exists
   */
  ensureTemplateDirectory(): void {
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
      this.logger.log(`Directorio de templates creado: ${this.templatesDir}`);
    }
  }

  /**
   * Get document type based on extension
   */
  private getDocumentType(extension: string): string {
    const types: Record<string, string> = {
      '.docx': 'Word Document',
      '.odt': 'OpenDocument Text',
      '.html': 'HTML Document',
      '.xlsx': 'Excel Spreadsheet',
      '.ods': 'OpenDocument Spreadsheet',
    };
    return types[extension] || 'unknown';
  }

  /**
   * Get detailed template information
   */
  getTemplateInfo(fileName: string): TemplateInfo {
    const filePath = join(this.templatesDir, fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Template ${fileName} no existe`);
    }

    const stats = statSync(filePath);
    const extension = extname(fileName).toLowerCase();

    return {
      name: fileName,
      id: parse(fileName).name,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      extension: extension,
      documentType: this.getDocumentType(extension),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isSupported: this.supportedFormats.includes(extension),
      path: filePath,
    };
  }

  /**
   * List all templates with metadata
   */
  listTemplatesWithMetadata(): TemplateInfo[] {
    this.ensureTemplateDirectory();

    const files = readdirSync(this.templatesDir);

    const templates = files
      .filter((file) => {
        const ext = extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      })
      .map((file) => {
        try {
          return this.getTemplateInfo(file);
        } catch (error) {
          this.logger.error(
            `Error procesando template ${file}: ${(error as Error).message}`,
          );
          return null;
        }
      })
      .filter((template): template is TemplateInfo => template !== null)
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    this.logger.log(`Se encontraron ${templates.length} templates válidos`);
    return templates;
  }

  /**
   * Check if template exists
   */
  templateExists(templateId: string): boolean {
    try {
      const files = readdirSync(this.templatesDir);
      return files.some((file) => {
        const fileNameWithoutExt = parse(file).name;
        return file === templateId || fileNameWithoutExt === templateId;
      });
    } catch {
      return false;
    }
  }

  /**
   * Find template by ID
   */
  findTemplate(templateId: string | null = null): string {
    if (!existsSync(this.templatesDir)) {
      throw new NotFoundException(
        `El directorio de templates no existe: ${this.templatesDir}`,
      );
    }

    const files = readdirSync(this.templatesDir);

    if (templateId) {
      // Find exact match first
      let templateFile = files.find((file) => file === templateId);

      // If not found, find file starting with the ID
      if (!templateFile) {
        templateFile = files.find(
          (file) =>
            file.startsWith(templateId) &&
            this.supportedFormats.some((ext) =>
              file.toLowerCase().endsWith(ext),
            ),
        );
      }

      if (!templateFile) {
        throw new NotFoundException(
          `No se encontró ningún template con ID: ${templateId}`,
        );
      }

      return join(this.templatesDir, templateFile);
    }

    // If no ID specified, find first valid template
    const templateFile = files.find((file) =>
      this.supportedFormats.some((ext) => file.toLowerCase().endsWith(ext)),
    );

    if (!templateFile) {
      throw new NotFoundException(
        `No se encontró ningún template válido en ${this.templatesDir}. 
        Por favor, coloca un archivo .docx, .odt, .html, .xlsx o .ods en esta carpeta.`,
      );
    }

    return join(this.templatesDir, templateFile);
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): boolean {
    this.ensureTemplateDirectory();

    const files = readdirSync(this.templatesDir);

    const targetFile = files.find((file) => {
      const fileNameWithoutExt = parse(file).name;
      return file === templateId || fileNameWithoutExt === templateId;
    });

    if (!targetFile) {
      throw new NotFoundException(
        `Template con ID ${templateId} no encontrado`,
      );
    }

    const filePath = join(this.templatesDir, targetFile);

    const extension = extname(targetFile).toLowerCase();
    if (!this.supportedFormats.includes(extension)) {
      throw new Error(`Archivo ${targetFile} no es un template válido`);
    }

    unlinkSync(filePath);
    this.logger.log(`Template eliminado: ${targetFile}`);
    return true;
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }

  /**
   * Get templates directory
   */
  getTemplatesDir(): string {
    return this.templatesDir;
  }
}
