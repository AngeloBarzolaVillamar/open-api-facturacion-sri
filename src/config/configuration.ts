import { requireEnv, optionalEnv, resolveDir } from '../common/utils/env.utils';

export default () => ({
  // Environment
  nodeEnv: optionalEnv('NODE_ENV', 'development'),

  // Server Configuration (REQUIRED)
  port: parseInt(requireEnv('PORT'), 10),
  publicUrl: requireEnv('PUBLIC_URL'),

  // Carbone API Configuration (REQUIRED)
  carboneApi: requireEnv('CARBONE_API'),

  // PDF Render Configuration (optional with sensible defaults)
  pdfRender: {
    maxAttempts: parseInt(optionalEnv('PDF_MAX_ATTEMPTS', '2'), 10),
    retryDelay: parseInt(optionalEnv('PDF_RETRY_DELAY', '10'), 10),
    supportedFormats: ['.docx', '.odt', '.html', '.xlsx', '.ods'],
  },

  // Carbone Render Options (optional with sensible defaults)
  carboneRenderOptions: {
    complement: {},
    enum: {},
    translations: {},
    isDebugActive: optionalEnv('CARBONE_DEBUG', 'false') === 'true',
    convertTo: optionalEnv('CARBONE_CONVERT_TO', 'pdf'),
    lang: optionalEnv('CARBONE_LANG', 'en-US'),
  },

  // Signature Configuration (optional with sensible defaults)
  signature: {
    qrSize: parseInt(optionalEnv('SIGNATURE_QR_SIZE', '50'), 10),
    totalWidth: parseInt(optionalEnv('SIGNATURE_TOTAL_WIDTH', '200'), 10),
    defaultX: parseInt(optionalEnv('SIGNATURE_DEFAULT_X', '0'), 10),
    defaultY: parseInt(optionalEnv('SIGNATURE_DEFAULT_Y', '0'), 10),
    defaultPage: parseInt(optionalEnv('SIGNATURE_DEFAULT_PAGE', '-1'), 10),
  },

  // SRI Ecuador - Facturación Electrónica (optional)
  sri: {
    environment: optionalEnv('SRI_ENVIRONMENT', 'development'),
    wsdl: {
      reception: requireEnv('SRI_RECEPTION_WSDL'),
      authorization: requireEnv('SRI_AUTHORIZATION_WSDL'),
    },
    signature: {
      certPath: process.env.SRI_SIGNATURE_CERT_PATH
        ? resolveDir(process.env.SRI_SIGNATURE_CERT_PATH)
        : '',
      certPassword: optionalEnv('SRI_SIGNATURE_CERT_PASSWORD', ''),
    },
  },

  // JWT Configuration (REQUIRED)
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRATION', '8h'),
  },

  // Rate Limiting
  throttler: {
    ttl: parseInt(optionalEnv('THROTTLE_TTL', '60000'), 10),
    limit: parseInt(optionalEnv('THROTTLE_LIMIT', '100'), 10),
  },

  // CORS
  cors: {
    allowedOrigins: optionalEnv(
      'ALLOWED_ORIGINS',
      'http://localhost:3000,http://localhost:3001',
    ),
  },

  // Encryption Configuration (REQUIRED)
  encryptionKey: requireEnv('ENCRYPTION_KEY'),
  encryptionSalt: requireEnv('ENCRYPTION_SALT'),

  // Database Configuration (PostgreSQL/Supabase)
  database: {
    host: optionalEnv('DB_HOST', 'localhost'),
    port: parseInt(optionalEnv('DB_PORT', '5432'), 10),
    name: optionalEnv('DB_NAME', 'postgres'),
    user: optionalEnv('DB_USER', 'postgres'),
    password: optionalEnv('DB_PASSWORD', ''),
    ssl: optionalEnv('DB_SSL', 'false'),
  },

  // Redis Configuration (BullMQ + Cache)
  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
    password: optionalEnv('REDIS_PASSWORD', ''),
    db: parseInt(optionalEnv('REDIS_DB', '0'), 10),
  },

  // Directory Paths (REQUIRED)
  directories: {
    templates: resolveDir(requireEnv('TEMPLATES_DIR')),
    pdfs: resolveDir(requireEnv('PDFS_DIR')),
    certs: resolveDir(requireEnv('CERTS_DIR')),
    xmls: resolveDir(requireEnv('XMLS_DIR')),
  },
});

export interface AppConfig {
  nodeEnv: string;
  port: number;
  publicUrl: string;
  carboneApi: string;
  pdfRender: {
    maxAttempts: number;
    retryDelay: number;
    supportedFormats: string[];
  };
  carboneRenderOptions: {
    complement: Record<string, unknown>;
    enum: Record<string, unknown>;
    translations: Record<string, unknown>;
    isDebugActive: boolean;
    convertTo: string;
    lang: string;
  };
  signature: {
    qrSize: number;
    totalWidth: number;
    defaultX: number;
    defaultY: number;
    defaultPage: number;
  };
  directories: {
    templates: string;
    pdfs: string;
    certs: string;
    xmls: string;
  };
  encryptionKey: string;
  encryptionSalt: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
}
