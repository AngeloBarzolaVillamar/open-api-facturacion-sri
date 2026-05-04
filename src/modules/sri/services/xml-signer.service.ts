import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { join } from 'path';
import * as forge from 'node-forge';
import { Crypto } from '@peculiar/webcrypto';
import * as xadesjs from 'xadesjs';
import * as xmlCore from 'xml-core';
import { DOMParser, XMLSerializer } from 'xmldom';
import { DatabaseService } from '../../../database';
import { EncryptionService } from '../../../common/services/encryption.service';
import { STORAGE_PATHS } from '../../../common/utils/storage-paths';

interface EmisorCertificado {
  certificado_nombre: string;
  certificado_password_encrypted: string;
}

/**
 * Servicio para firmar documentos XML con firma digital XAdES-BES
 * compatible con los requerimientos del SRI Ecuador.
 *
 * Soporta dos modos:
 * 1. Certificado global (desde env vars) - para compatibilidad
 * 2. Certificado por emisor (desde BD) - recomendado para multi-tenant
 */
@Injectable()
export class XmlSignerService implements OnModuleInit {
  private readonly logger = new Logger(XmlSignerService.name);
  private privateKey: CryptoKey | null = null;
  private certificate: string | null = null;
  private certificateChain: string[] = [];
  private crypto: Crypto;

  // Cache de certificados por RUC con TTL para evitar usar certificados vencidos
  private emisorCertificateCache: Map<
    string,
    { privateKey: CryptoKey; certificate: string; loadedAt: number }
  > = new Map();
  private readonly CERT_CACHE_TTL_MS: number;

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
    private encryptionService: EncryptionService,
  ) {
    this.crypto = new Crypto();
    this.CERT_CACHE_TTL_MS = this.configService.get<number>(
      'CACHE_CERT_TTL_MS',
      3600000,
    ); // 1h default
    // Register Node.js DOM dependencies for xadesjs/xmldsigjs
    xmlCore.setNodeDependencies({
      DOMParser,
      XMLSerializer,
    });

    xadesjs.Application.setEngine('NodeJS', this.crypto);
  }

  onModuleInit() {
    // Los certificados se cargan dinámicamente desde la BD por emisor
    // No se usa certificado global - cada emisor debe tener su certificado configurado
    this.logger.log(
      'XmlSignerService inicializado. Certificados se cargan desde BD por emisor.',
    );
  }

  async loadCertificate(p12Path: string, password: string): Promise<void> {
    this.logger.log(`Cargando certificado P12 desde: ${p12Path}`);

    // Prevenir Path Traversal
    const resolvedPath = path.resolve(p12Path);
    const certsBaseDir = path.resolve(STORAGE_PATHS.certs);
    if (!resolvedPath.startsWith(certsBaseDir)) {
      throw new Error(
        `Ruta de certificado inválida o no permitida: ${p12Path}`,
      );
    }

    if (!existsSync(resolvedPath)) {
      throw new Error(`El archivo de certificado no existe: ${resolvedPath}`);
    }

    const p12Buffer = readFileSync(resolvedPath);
    await this.loadCertificateFromBuffer(p12Buffer, password);
  }

  async loadCertificateFromBuffer(
    p12Buffer: Buffer,
    password: string,
  ): Promise<void> {
    this.logger.log('Procesando certificado P12');

    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let forgePrivateKey: forge.pki.PrivateKey | null = null;
    let signingCert: forge.pki.Certificate | null = null;
    const chainCerts: forge.pki.Certificate[] = [];

    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          forgePrivateKey = safeBag.key as forge.pki.PrivateKey;
        } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          const cert = safeBag.cert;
          const isCA =
            cert.extensions &&
            cert.extensions.some(
              (ext: any) => ext.name === 'basicConstraints' && ext.cA === true,
            );

          if (!isCA) {
            signingCert = cert;
          } else {
            chainCerts.push(cert);
          }
        }
      });
    });

    if (!forgePrivateKey || !signingCert) {
      throw new Error(
        'No se encontró clave privada o certificado en el archivo P12',
      );
    }

    const privateKeyPem = forge.pki.privateKeyToPem(forgePrivateKey);
    this.privateKey = await this.importPrivateKey(privateKeyPem);

    this.certificate = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(signingCert)).getBytes(),
    );

    this.certificateChain = chainCerts.map((cert) =>
      forge.util.encode64(
        forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
      ),
    );

    this.logger.log('Certificado P12 cargado y procesado exitosamente');
  }

  async signXml(xmlString: string): Promise<string> {
    if (!this.privateKey || !this.certificate) {
      throw new Error(
        'No hay certificado cargado. Use loadCertificate() primero.',
      );
    }

    this.logger.log('Iniciando firma XAdES-BES del documento XML');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    const rootElement = xmlDoc.documentElement;
    if (!rootElement) {
      throw new Error('El documento XML no tiene un elemento raíz');
    }

    if (!rootElement.hasAttribute('id') && !rootElement.hasAttribute('Id')) {
      rootElement.setAttribute('Id', 'comprobante');
    }

    const referenceId =
      rootElement.getAttribute('id') ||
      rootElement.getAttribute('Id') ||
      'comprobante';

    const signedXml = new xadesjs.SignedXml();

    const reference = await signedXml.Sign(
      {
        name: 'RSA-SHA1',
      },
      this.privateKey,
      xmlDoc,
      {
        x509: [this.certificate],
        references: [
          {
            id: 'Reference-' + referenceId,
            uri: '#' + referenceId,
            hash: 'SHA-1',
            transforms: ['enveloped', 'c14n'],
          },
        ],
        signerRole: {
          claimed: ['Emisor'],
        },
        signingTime: {
          value: new Date(),
        },
      },
    );

    const signedXmlDoc = reference.GetXml();
    if (!signedXmlDoc) {
      throw new Error('Error al generar el XML firmado');
    }

    rootElement.appendChild(signedXmlDoc);

    const serializer = new XMLSerializer();
    const signedXmlString = serializer.serializeToString(xmlDoc);

    this.logger.log('Documento XML firmado exitosamente con XAdES-BES');
    return signedXmlString;
  }

  isCertificateLoaded(): boolean {
    return this.privateKey !== null && this.certificate !== null;
  }

  private async importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
      .replace(/-----END RSA PRIVATE KEY-----/, '')
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const binaryDer = Buffer.from(pemContents, 'base64');

    try {
      return await this.crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-1',
        },
        true,
        ['sign'],
      );
    } catch {
      this.logger.log('Intentando conversión de PKCS#1 a PKCS#8');

      const privateKey = forge.pki.privateKeyFromPem(pem);
      const pkcs8Pem = forge.pki.privateKeyInfoToPem(
        forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey)),
      );

      const pkcs8Contents = pkcs8Pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '');

      const pkcs8Binary = Buffer.from(pkcs8Contents, 'base64');

      return await this.crypto.subtle.importKey(
        'pkcs8',
        pkcs8Binary,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-1',
        },
        true,
        ['sign'],
      );
    }
  }

  /**
   * Get certs directory from configuration
   */
  private getCertsDir(): string {
    return this.configService.get<string>('directories.certs') || '';
  }

  /**
   * Decrypt password using EncryptionService
   */
  private async decryptPassword(encryptedPassword: string): Promise<string> {
    return this.encryptionService.decrypt(encryptedPassword);
  }

  /**
   * Load certificate for a specific emisor from database
   * Returns cached version if available
   */
  async loadEmisorCertificate(
    ruc: string,
  ): Promise<{ privateKey: CryptoKey; certificate: string }> {
    // Check cache first (with TTL)
    const cached = this.emisorCertificateCache.get(ruc);
    const now = Date.now();
    if (cached && now - cached.loadedAt < this.CERT_CACHE_TTL_MS) {
      this.logger.debug(`Usando certificado cacheado para emisor RUC: ${ruc}`);
      return { privateKey: cached.privateKey, certificate: cached.certificate };
    }

    if (cached) {
      this.logger.log(
        `Cache de certificado expirado para RUC: ${ruc}, recargando...`,
      );
      this.emisorCertificateCache.delete(ruc);
    }

    this.logger.log(`Cargando certificado desde BD para emisor RUC: ${ruc}`);

    // Get certificate info from database
    const emisor = await this.db.queryOne<EmisorCertificado>(
      `SELECT certificado_nombre, certificado_password_encrypted 
       FROM emisores 
       WHERE ruc = $1 AND estado = 'ACTIVO'`,
      [ruc],
    );

    if (
      !emisor ||
      !emisor.certificado_nombre ||
      !emisor.certificado_password_encrypted
    ) {
      throw new Error(
        `El emisor con RUC ${ruc} no tiene certificado configurado. Por favor suba un certificado P12.`,
      );
    }

    // Decrypt password
    const password = await this.decryptPassword(
      emisor.certificado_password_encrypted,
    );

    // Load certificate from filesystem
    const certPath = join(this.getCertsDir(), emisor.certificado_nombre);
    if (!existsSync(certPath)) {
      throw new Error(
        `El archivo de certificado ${emisor.certificado_nombre} no existe en el servidor.`,
      );
    }

    const p12Buffer = readFileSync(certPath);

    // Process P12 certificate
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let forgePrivateKey: forge.pki.PrivateKey | null = null;
    let signingCert: forge.pki.Certificate | null = null;

    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          forgePrivateKey = safeBag.key as forge.pki.PrivateKey;
        } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          const cert = safeBag.cert;
          const isCA =
            cert.extensions &&
            cert.extensions.some(
              (ext: any) => ext.name === 'basicConstraints' && ext.cA === true,
            );

          if (!isCA) {
            signingCert = cert;
          }
        }
      });
    });

    if (!forgePrivateKey || !signingCert) {
      throw new Error(
        'No se encontró clave privada o certificado en el archivo P12',
      );
    }

    const privateKeyPem = forge.pki.privateKeyToPem(forgePrivateKey);
    const privateKey = await this.importPrivateKey(privateKeyPem);

    const certificate = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(signingCert)).getBytes(),
    );

    // Cache the result with timestamp
    const result = { privateKey, certificate, loadedAt: Date.now() };
    this.emisorCertificateCache.set(ruc, result);
    this.logger.log(
      `Certificado para emisor RUC ${ruc} cargado y cacheado exitosamente`,
    );

    return result;
  }

  /**
   * Sign XML using emisor's certificate from database
   * This is the recommended method for multi-tenant scenarios
   */
  async signXmlForEmisor(xmlString: string, ruc: string): Promise<string> {
    this.logger.log(`Firmando XML para emisor RUC: ${ruc}`);

    const { privateKey, certificate } = await this.loadEmisorCertificate(ruc);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    const rootElement = xmlDoc.documentElement;
    if (!rootElement) {
      throw new Error('El documento XML no tiene un elemento raíz');
    }

    if (!rootElement.hasAttribute('id') && !rootElement.hasAttribute('Id')) {
      rootElement.setAttribute('Id', 'comprobante');
    }

    const referenceId =
      rootElement.getAttribute('id') ||
      rootElement.getAttribute('Id') ||
      'comprobante';

    const signedXml = new xadesjs.SignedXml();

    const reference = await signedXml.Sign(
      {
        name: 'RSA-SHA1',
      },
      privateKey,
      xmlDoc,
      {
        x509: [certificate],
        references: [
          {
            id: 'Reference-' + referenceId,
            uri: '#' + referenceId,
            hash: 'SHA-1',
            transforms: ['enveloped', 'c14n'],
          },
        ],
        signerRole: {
          claimed: ['Emisor'],
        },
        signingTime: {
          value: new Date(),
        },
      },
    );

    const signedXmlDoc = reference.GetXml();
    if (!signedXmlDoc) {
      throw new Error('Error al generar el XML firmado');
    }

    rootElement.appendChild(signedXmlDoc);

    const serializer = new XMLSerializer();
    const signedXmlString = serializer.serializeToString(xmlDoc);

    this.logger.log(
      'Documento XML firmado exitosamente con XAdES-BES para emisor: ' + ruc,
    );
    return signedXmlString;
  }

  /**
   * Clear certificate cache for a specific emisor (useful when certificate is updated)
   */
  clearEmisorCache(ruc: string): void {
    this.emisorCertificateCache.delete(ruc);
    this.logger.log(`Cache de certificado limpiado para emisor RUC: ${ruc}`);
  }

  /**
   * Clear all cached certificates
   */
  clearAllCache(): void {
    this.emisorCertificateCache.clear();
    this.logger.log('Cache de todos los certificados limpiado');
  }

  /**
   * @deprecated - Usar signXmlForEmisor() para multi-tenant.
   * Permite limpiar el certificado legacy cargado de memoria.
   */
  clearGlobalCertificate(): void {
    this.privateKey = null;
    this.certificate = null;
    this.certificateChain = [];
    this.logger.warn('Certificado global limpiado de memoria');
  }
}
