import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Service for storing XML files in the filesystem
 * Organizes files by RUC/year/month for easy retrieval and 7-year retention
 */
@Injectable()
export class XmlStorageService implements OnModuleInit {
  private readonly logger = new Logger(XmlStorageService.name);
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir =
      this.configService.get<string>('directories.xmls') || '../xmls';
  }

  onModuleInit() {
    // Ensure base directory exists
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
      this.logger.log(`Directorio de XMLs creado: ${this.baseDir}`);
    } else {
      this.logger.log(`Directorio de XMLs: ${this.baseDir}`);
    }
  }

  /**
   * Generates the directory path for a comprobante based on RUC and date
   * Structure: /xmls/{ruc}/{year}/{month}/
   */
  private getComprobantePath(ruc: string, fecha: Date): string {
    const year = fecha.getFullYear().toString();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    return join(this.baseDir, ruc, year, month);
  }

  /**
   * Ensures the directory exists for storing the XML
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Saves an XML file and returns the relative path
   * Structure: {ruc}/{year}/{month}/{tipo_subdir}/{claveAcceso}.xml
   */
  saveXml(
    ruc: string,
    claveAcceso: string,
    fechaEmision: Date,
    tipo: 'sin_firma' | 'firmado' | 'autorizado',
    xmlContent: string,
  ): string {
    // Map tipo to subdirectory name
    const subdirMap: Record<string, string> = {
      sin_firma: 'sin_firmar',
      firmado: 'firmados',
      autorizado: 'autorizados',
    };
    const subdir = subdirMap[tipo] || tipo;

    const baseDirPath = this.getComprobantePath(ruc, fechaEmision);
    const dirPath = join(baseDirPath, subdir);
    this.ensureDirectoryExists(dirPath);

    const filename = `${claveAcceso}.xml`;
    const fullPath = join(dirPath, filename);
    const year = fechaEmision.getFullYear().toString();
    const month = (fechaEmision.getMonth() + 1).toString().padStart(2, '0');
    const relativePath = join(ruc, year, month, subdir, filename);

    writeFileSync(fullPath, xmlContent, 'utf-8');
    this.logger.debug(`XML guardado: ${relativePath}`);

    return relativePath;
  }

  /**
   * Saves all XML versions for a comprobante
   */
  saveAllXmls(
    ruc: string,
    claveAcceso: string,
    fechaEmision: Date,
    xmlSinFirma?: string,
    xmlFirmado?: string,
    xmlAutorizado?: string,
  ): { sinFirmaPath?: string; firmadoPath?: string; autorizadoPath?: string } {
    const paths: {
      sinFirmaPath?: string;
      firmadoPath?: string;
      autorizadoPath?: string;
    } = {};

    if (xmlSinFirma) {
      paths.sinFirmaPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'sin_firma',
        xmlSinFirma,
      );
    }
    if (xmlFirmado) {
      paths.firmadoPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'firmado',
        xmlFirmado,
      );
    }
    if (xmlAutorizado) {
      paths.autorizadoPath = this.saveXml(
        ruc,
        claveAcceso,
        fechaEmision,
        'autorizado',
        xmlAutorizado,
      );
    }

    return paths;
  }

  /**
   * Reads an XML file by its relative path
   */
  readXml(relativePath: string): string | null {
    const fullPath = join(this.baseDir, relativePath);
    if (existsSync(fullPath)) {
      return readFileSync(fullPath, 'utf-8');
    }
    return null;
  }

  /**
   * Gets the full path for downloading
   */
  getFullPath(relativePath: string): string {
    return join(this.baseDir, relativePath);
  }
}
