import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFileSync,
} from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

export interface CertificateInfo {
  name: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface CertificateSubject {
  commonName: string;
  organization: string;
  country: string;
}

export interface CertificateIssuer {
  commonName: string;
  organization: string;
}

export interface CertificateValidation {
  isValid: boolean;
  isExpired: boolean;
  isNotYetValid: boolean;
  expiryDate: Date;
  startDate: Date;
  daysUntilExpiry: number;
  subject: CertificateSubject;
  issuer: CertificateIssuer;
  reason?: string;
  warning?: string;
}

export interface ExtractedCertInfo {
  subject: CertificateSubject;
  issuer: CertificateIssuer;
  validity: {
    notBefore: Date;
    notAfter: Date;
  };
  serialNumber: string;
  isExpired: boolean;
  daysUntilExpiry: number;
}

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  /**
   * Get certs directory from STORAGE_PATHS
   */
  private get certsDir(): string {
    return STORAGE_PATHS.certs;
  }

  /**
   * Ensure certificate directory exists
   */
  ensureCertificateDirectory(): void {
    if (!existsSync(this.certsDir)) {
      mkdirSync(this.certsDir, { recursive: true });
      this.logger.log(`Directorio de certificados creado: ${this.certsDir}`);
    }
  }

  /**
   * Check if certificate exists
   */
  certificateExists(fileName: string): boolean {
    const filePath = join(this.certsDir, fileName);
    return existsSync(filePath);
  }

  /**
   * Get certificate file path
   */
  getCertificatePath(fileName: string): string {
    return join(this.certsDir, fileName);
  }

  /**
   * Get certs directory
   */
  getCertsDir(): string {
    return this.certsDir;
  }

  /**
   * List all certificates with optional pagination
   */
  listCertificates(options: { page?: number; limit?: number } = {}): {
    certificates: CertificateInfo[];
    pagination: any;
    total: number;
  } {
    this.ensureCertificateDirectory();

    const allCerts = readdirSync(this.certsDir)
      .filter((file) => file.toLowerCase().endsWith('.p12'))
      .map((file) => {
        const stats = statSync(join(this.certsDir, file));
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    const total = allCerts.length;

    // If no pagination, return all
    if (!options.page && !options.limit) {
      this.logger.log(`Se encontraron ${total} certificados`);
      return {
        certificates: allCerts,
        pagination: null,
        total: total,
      };
    }

    // Apply pagination
    const page = Math.max(1, parseInt(String(options.page)) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(String(options.limit)) || 10),
    );
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedCerts = allCerts.slice(offset, offset + limit);

    return {
      certificates: paginatedCerts,
      pagination: {
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      total: total,
    };
  }

  /**
   * Delete a certificate
   */
  deleteCertificate(fileName: string): boolean {
    if (!fileName || !fileName.toLowerCase().endsWith('.p12')) {
      throw new BadRequestException(
        'Nombre de archivo inválido. Debe tener extensión .p12',
      );
    }

    const filePath = join(this.certsDir, fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El certificado ${fileName} no existe`);
    }

    unlinkSync(filePath);
    this.logger.log(`Certificado eliminado: ${fileName}`);
    return true;
  }

  /**
   * Get basic certificate info (without password)
   */
  getCertificateInfo(fileName: string): CertificateInfo & { path: string } {
    if (!this.certificateExists(fileName)) {
      throw new NotFoundException(`El certificado ${fileName} no existe`);
    }

    const filePath = join(this.certsDir, fileName);
    const stats = statSync(filePath);

    return {
      name: fileName,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      path: filePath,
    };
  }

  /**
   * Extract detailed P12 certificate information
   */
  extractP12CertificateInfo(
    fileName: string,
    password: string,
  ): ExtractedCertInfo {
    if (!this.certificateExists(fileName)) {
      throw new NotFoundException(`El certificado ${fileName} no existe`);
    }

    const filePath = join(this.certsDir, fileName);
    const p12Buffer = readFileSync(filePath);

    return this.extractCertInfoFromBuffer(p12Buffer, password);
  }

  /**
   * Extract certificate info from buffer
   */
  extractCertInfoFromBuffer(
    p12Buffer: Buffer,
    password: string,
  ): ExtractedCertInfo {
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let signingCert: forge.pki.Certificate | null = null;

    // Find signing certificate
    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          if (!signingCert) {
            signingCert = safeBag.cert;
          } else {
            const isCA =
              safeBag.cert.extensions &&
              safeBag.cert.extensions.some(
                (ext: any) =>
                  ext.name === 'basicConstraints' && ext.cA === true,
              );
            if (!isCA) {
              signingCert = safeBag.cert;
            }
          }
        }
      });
    });

    if (!signingCert) {
      throw new Error('No se pudo extraer el certificado del archivo P12');
    }

    const subject = (signingCert as forge.pki.Certificate).subject;
    const issuer = (signingCert as forge.pki.Certificate).issuer;
    const validFrom = (signingCert as forge.pki.Certificate).validity.notBefore;
    const validTo = (signingCert as forge.pki.Certificate).validity.notAfter;

    return {
      subject: {
        commonName: subject.getField('CN')?.value || 'No disponible',
        organization: subject.getField('O')?.value || 'No disponible',
        country: subject.getField('C')?.value || 'No disponible',
      },
      issuer: {
        commonName: issuer.getField('CN')?.value || 'No disponible',
        organization: issuer.getField('O')?.value || 'No disponible',
      },
      validity: {
        notBefore: validFrom,
        notAfter: validTo,
      },
      serialNumber: (signingCert as forge.pki.Certificate).serialNumber,
      isExpired: new Date() > validTo,
      daysUntilExpiry: Math.ceil(
        (validTo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      ),
    };
  }

  /**
   * Validate certificate expiry
   */
  validateCertificateExpiry(
    fileName: string,
    password: string,
  ): CertificateValidation {
    const certInfo = this.extractP12CertificateInfo(fileName, password);
    const now = new Date();
    const expiryDate = certInfo.validity.notAfter;
    const startDate = certInfo.validity.notBefore;

    const validation: CertificateValidation = {
      isValid: true,
      isExpired: now > expiryDate,
      isNotYetValid: now < startDate,
      expiryDate: expiryDate,
      startDate: startDate,
      daysUntilExpiry: Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
      subject: certInfo.subject,
      issuer: certInfo.issuer,
    };

    // Determine if certificate is valid
    if (validation.isExpired) {
      validation.isValid = false;
      validation.reason = `Certificado expirado el ${expiryDate.toLocaleDateString()}`;
      this.logger.error(
        `Certificado ${fileName} EXPIRADO: ${validation.reason}`,
      );
    } else if (validation.isNotYetValid) {
      validation.isValid = false;
      validation.reason = `Certificado no válido hasta ${startDate.toLocaleDateString()}`;
      this.logger.error(
        `Certificado ${fileName} NO VÁLIDO AÚN: ${validation.reason}`,
      );
    } else if (validation.daysUntilExpiry <= 30) {
      // Warning if expires in less than 30 days
      validation.warning = `Certificado expira en ${validation.daysUntilExpiry} días`;
      this.logger.warn(
        `Certificado ${fileName} próximo a expirar: ${validation.warning}`,
      );
    }

    return validation;
  }
}
