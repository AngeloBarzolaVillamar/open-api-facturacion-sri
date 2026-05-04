import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

/**
 * Servicio centralizado de encriptación/desencriptación AES-256-CBC.
 *
 * Utiliza:
 * - ENCRYPTION_KEY (requerida): clave de 32 bytes para AES-256
 * - ENCRYPTION_SALT (requerida): salt para derivación de clave con scrypt
 *
 * Formato de salida: "iv_hex:encrypted_hex"
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: string;
  private readonly encryptionSalt: string;
  private keyCache: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>('encryptionKey')!;
    this.encryptionSalt = this.configService.get<string>('encryptionSalt')!;

    if (!this.encryptionKey || !this.encryptionSalt) {
      throw new Error(
        'ENCRYPTION_KEY y ENCRYPTION_SALT son requeridas. Defínelas en tu archivo .env',
      );
    }

    this.logger.log('EncryptionService inicializado correctamente');
  }

  /**
   * Deriva la clave de encriptación usando scrypt.
   * Cachea el resultado para evitar derivaciones repetidas.
   */
  private async deriveKey(): Promise<Buffer> {
    if (this.keyCache) {
      return this.keyCache;
    }

    const scryptAsync = promisify(scrypt);
    this.keyCache = (await scryptAsync(
      this.encryptionKey,
      this.encryptionSalt,
      32,
    )) as Buffer;

    return this.keyCache;
  }

  /**
   * Encripta un texto plano usando AES-256-CBC.
   * @param plainText - Texto a encriptar
   * @returns Texto encriptado en formato "iv_hex:encrypted_hex"
   */
  async encrypt(plainText: string): Promise<string> {
    const iv = randomBytes(16);
    const key = await this.deriveKey();
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Desencripta un texto encriptado con AES-256-CBC.
   * @param encryptedText - Texto en formato "iv_hex:encrypted_hex"
   * @returns Texto plano original
   */
  async decrypt(encryptedText: string): Promise<string> {
    const [ivHex, encryptedHex] = encryptedText.split(':');

    if (!ivHex || !encryptedHex) {
      throw new Error(
        'Formato de texto encriptado inválido. Se esperaba "iv:encrypted"',
      );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = await this.deriveKey();
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
