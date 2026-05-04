import { resolve } from 'path';
import { requireEnv, resolveDir, ensureDir } from './env.utils';

/**
 * Gets directory paths from environment variables
 * All paths are REQUIRED - no fallbacks
 */
export const STORAGE_PATHS = {
  get templates(): string {
    const dir = resolveDir(requireEnv('TEMPLATES_DIR'));
    ensureDir(dir);
    return dir;
  },
  get pdfs(): string {
    const dir = resolveDir(requireEnv('PDFS_DIR'));
    ensureDir(dir);
    return dir;
  },
  get certs(): string {
    const dir = resolveDir(requireEnv('CERTS_DIR'));
    ensureDir(dir);
    return dir;
  },
  get pdfsConFirma(): string {
    const dir = resolve(this.pdfs, 'con_firma');
    ensureDir(dir);
    return dir;
  },
  get pdfsOthers(): string {
    const dir = resolve(this.pdfs, 'others');
    ensureDir(dir);
    return dir;
  },
  get pdfsDocuments(): string {
    const dir = resolve(this.pdfs, 'documents');
    ensureDir(dir);
    return dir;
  },
  get pdfsImages(): string {
    const dir = resolve(this.pdfs, 'images');
    ensureDir(dir);
    return dir;
  },
};

/**
 * Sanitizes a filename by replacing spaces and special characters
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Get the extension
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;

  const name = hasExtension ? filename.substring(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.substring(lastDotIndex) : '';

  // Replace spaces with underscores, remove special characters
  const sanitizedName = name
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[áàäâ]/gi, 'a') // Replace accented characters
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove any other special characters
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  return sanitizedName + extension.toLowerCase();
}

/**
 * Generates a unique filename with timestamp
 * @param originalName - Original filename
 * @param prefix - Optional prefix
 * @returns Unique filename with timestamp
 */
export function generateUniqueFilename(
  originalName: string,
  prefix?: string,
): string {
  const sanitized = sanitizeFilename(originalName);
  const timestamp = Date.now();

  if (prefix) {
    return `${prefix}_${timestamp}_${sanitized}`;
  }

  return `${timestamp}_${sanitized}`;
}
