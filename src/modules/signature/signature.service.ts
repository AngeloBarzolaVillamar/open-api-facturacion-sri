import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { SignPdf } from '@signpdf/signpdf';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { STORAGE_PATHS } from '../../common/utils/storage-paths';

export interface SignaturePosition {
  page?: number;
  x?: number;
  y?: number;
}

export interface CertificateInfo {
  subject: {
    commonName: string;
    organization: string;
    country: string;
  };
  issuer: {
    commonName: string;
    organization: string;
  };
  validity: {
    notBefore: Date;
    notAfter: Date;
  };
  serialNumber: string;
}

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private readonly signatureConfig: {
    qrSize: number;
    totalWidth: number;
    defaultX: number;
    defaultY: number;
    defaultPage: number;
  };
  private readonly signpdfInstance: SignPdf;

  constructor(private configService: ConfigService) {
    const signConfig = this.configService.get('signature');
    this.signatureConfig = {
      qrSize: signConfig?.qrSize || 50,
      totalWidth: signConfig?.totalWidth || 200,
      defaultX: signConfig?.defaultX || 0,
      defaultY: signConfig?.defaultY || 0,
      defaultPage: signConfig?.defaultPage || -1,
    };

    this.signpdfInstance = new SignPdf();
  }

  /**
   * Get directories from STORAGE_PATHS
   */
  private get certsDir(): string {
    return STORAGE_PATHS.certs;
  }

  private get pdfDir(): string {
    return STORAGE_PATHS.pdfs;
  }

  private get signedPdfDir(): string {
    return STORAGE_PATHS.pdfsConFirma;
  }

  /**
   * Generate QR code with signature information
   */
  async generateQR(signatureInfo: string): Promise<Buffer> {
    this.logger.log('Generando código QR para la firma');
    return QRCode.toBuffer(signatureInfo, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      width: 200,
    });
  }

  /**
   * Extract certificate information from P12 buffer
   */
  extractCertificateInfo(p12Buffer: Buffer, password: string): CertificateInfo {
    this.logger.log('Extrayendo información del certificado P12');

    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey: forge.pki.PrivateKey | null = null;
    let signingCert: forge.pki.Certificate | null = null;

    // Find private key and signing certificate
    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          privateKey = safeBag.key as forge.pki.PrivateKey;
        } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
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

    if (!privateKey || !signingCert) {
      throw new Error(
        'No se pudo extraer la clave privada o el certificado del archivo P12',
      );
    }

    const subject = (signingCert as forge.pki.Certificate).subject;
    const issuer = (signingCert as forge.pki.Certificate).issuer;

    const certInfo: CertificateInfo = {
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
        notBefore: (signingCert as forge.pki.Certificate).validity.notBefore,
        notAfter: (signingCert as forge.pki.Certificate).validity.notAfter,
      },
      serialNumber: (signingCert as forge.pki.Certificate).serialNumber,
    };

    this.logger.log(
      `Certificado extraído - Titular: ${certInfo.subject.commonName}`,
    );
    return certInfo;
  }

  /**
   * Add visual signature to PDF
   */
  async addVisualSignature(
    pdfBuffer: Buffer,
    qrImageBuffer: Buffer,
    personName: string,
    organization: string,
    issuerName: string,
    currentDate: string,
    position: SignaturePosition,
  ): Promise<Buffer> {
    this.logger.log('Procesando firma visual');

    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Add basic metadata
    pdfDoc.setAuthor('Documento firmado electrónicamente');
    pdfDoc.setSubject('Firmado con certificado P12');
    pdfDoc.setProducer(`Firmado por: ${personName}`);
    pdfDoc.setCreator(`Emisor: ${issuerName}`);

    // Determine page for signature
    const pages = pdfDoc.getPages();
    const defaultPage = this.signatureConfig.defaultPage;
    const pageIndex =
      position.page === undefined
        ? defaultPage < 0
          ? pages.length + defaultPage
          : defaultPage
        : position.page < 0
          ? pages.length + position.page
          : position.page;

    const targetPage =
      pages[Math.max(0, Math.min(pageIndex, pages.length - 1))];
    this.logger.log(
      `Aplicando firma en página ${pageIndex + 1} de ${pages.length}`,
    );

    // Load fonts and QR
    const font = await pdfDoc.embedFont(StandardFonts.Courier);
    const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const qrImage = await pdfDoc.embedPng(qrImageBuffer);

    // Dimensions from config
    const qrSize = this.signatureConfig.qrSize;

    // X and Y position
    const x =
      position.x !== undefined ? position.x : this.signatureConfig.defaultX;
    const y =
      position.y !== undefined ? position.y : this.signatureConfig.defaultY;
    this.logger.log(`Posición de firma: x=${x}, y=${y}`);

    // Draw QR on left
    targetPage.drawImage(qrImage, {
      x: x,
      y: y,
      width: qrSize,
      height: qrSize,
    });

    // Add signature text on right of QR
    targetPage.drawText('Firmado electrónicamente por:', {
      x: x + qrSize + 2,
      y: y + qrSize - 15,
      size: 7,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Name
    targetPage.drawText(personName, {
      x: x + qrSize + 2,
      y: y + qrSize - 30,
      size: 7,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Date
    targetPage.drawText(currentDate, {
      x: x + qrSize + 2,
      y: y + qrSize - 45,
      size: 7,
      font: font,
      color: rgb(0, 0, 0),
    });

    this.logger.log('Firma visual aplicada correctamente');

    return Buffer.from(await pdfDoc.save());
  }

  /**
   * Sign a PDF with P12 certificate
   */
  async signPDF(
    pdfBuffer: Buffer,
    certFile: string,
    password: string,
    position: SignaturePosition = {},
  ): Promise<Buffer> {
    try {
      this.logger.log(
        `Iniciando proceso de firma con certificado: ${certFile}`,
      );

      // Verify certificate exists
      const certPath = join(this.certsDir, certFile);
      if (!existsSync(certPath)) {
        throw new Error(
          `El certificado ${certFile} no existe en el directorio de certificados`,
        );
      }

      // Read P12 certificate
      const p12Buffer = readFileSync(certPath);

      // Extract certificate info
      const certInfo = this.extractCertificateInfo(p12Buffer, password);

      // Prepare data for visual signature
      const personName = certInfo.subject.commonName;
      const organization = certInfo.subject.organization || 'No disponible';
      const issuerName = certInfo.issuer.commonName;
      const currentDate = new Date().toLocaleString('es-ES', {
        timeZone: 'America/Guayaquil',
      });

      // Generate QR code
      const qrInfo = `Firmado digitalmente por: ${personName}\nOrganización: ${organization}\nFecha y hora: ${currentDate}\nSerial: ${certInfo.serialNumber}`;
      const qrImageBuffer = await this.generateQR(qrInfo);
      this.logger.log('Código QR generado correctamente');

      // Create visual signature on PDF
      this.logger.log('Añadiendo firma visual al documento');
      const pdfWithVisual = await this.addVisualSignature(
        pdfBuffer,
        qrImageBuffer,
        personName,
        organization,
        issuerName,
        currentDate,
        position,
      );

      // Prepare compatible PDF for digital signature
      this.logger.log('Preparando PDF para compatibilidad con firma digital');
      const pdfDoc = await PDFDocument.create();
      const originalPdf = await PDFDocument.load(pdfWithVisual);
      const pagesCopy = await pdfDoc.copyPages(
        originalPdf,
        originalPdf.getPageIndices(),
      );

      // Add pages
      pagesCopy.forEach((page) => pdfDoc.addPage(page));

      // Add metadata for compatibility
      this.logger.log(
        'Configurando metadatos para compatibilidad con firma digital',
      );
      pdfDoc.setTitle('Documento firmado electrónicamente');
      pdfDoc.setAuthor(certInfo.subject.commonName);
      pdfDoc.setSubject('Documento firmado digitalmente');
      pdfDoc.setProducer(certInfo.subject.organization || 'Sistema de firmas');
      pdfDoc.setCreator(`Firmado por: ${certInfo.subject.commonName}`);

      // Save compatible PDF in memory
      const compatiblePdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const compatiblePdfBuffer = Buffer.from(compatiblePdfBytes);

      // Add placeholder for digital signature
      // signatureLength must be large enough to hold the entire signature
      // including certificate chain. Default is 16384, but some P12 certs need more.
      this.logger.log('Añadiendo placeholder para la firma digital');
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer: compatiblePdfBuffer,
        reason: '',
        contactInfo: certInfo.subject.commonName,
        name: certInfo.subject.commonName,
        location: '',
        signatureLength: 32768, // 32KB - sufficient for P12 with certificate chain
      });

      // Create P12 signer
      this.logger.log('Creando firmador P12');
      const signer = new P12Signer(p12Buffer, { passphrase: password });

      // Sign the PDF
      this.logger.log('Firmando el PDF digitalmente');
      try {
        const signedPdf = await this.signpdfInstance.sign(
          pdfWithPlaceholder,
          signer,
        );
        this.logger.log('PDF firmado correctamente');
        return signedPdf;
      } catch (signErr) {
        this.logger.error(
          `Error específico en el proceso de firma: ${(signErr as Error).message}`,
        );

        // If cryptographic signature fails, return PDF with visual signature only
        this.logger.warn(
          'Devolviendo PDF con firma visual solamente como fallback',
        );
        return pdfWithVisual;
      }
    } catch (error) {
      this.logger.error(
        `Error en el proceso de firma: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
