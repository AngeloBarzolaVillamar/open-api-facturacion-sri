import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Validates that a required environment variable is set.
 * Throws error if the variable is missing.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable de entorno requerida no definida: ${name}. Verifica tu archivo .env`,
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with a fallback.
 * Only used for truly optional configuration.
 */
export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * Resolves a directory path - handles both absolute and relative paths.
 * Relative paths are resolved from the project root (process.cwd()).
 */
export function resolveDir(path: string): string {
  if (path.startsWith('/') || path.includes(':')) {
    return path;
  }
  return resolve(process.cwd(), path);
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
