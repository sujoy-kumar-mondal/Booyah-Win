import fs from 'node:fs';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from project root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  OTP_HMAC_SECRET: z.string().min(32, 'OTP_HMAC_SECRET must be at least 32 characters'),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().default('booyah-private'),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_MOBILE: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  FILE_URL_SECRET: z.string().optional(),
  DATABASE_SSL: z.string().optional(),
  DATABASE_SSL_CA: z.string().optional(),
  DATABASE_SSL_CA_BASE64: z.string().optional(),
  DATABASE_SSL_CA_FILE: z.string().optional(),
});

function validateAndNormalizePem(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (
    !normalized.includes('-----BEGIN CERTIFICATE-----') ||
    !normalized.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error('Invalid CA certificate: malformed PEM format.');
  }
  return normalized;
}

export function resolveDatabaseSslCa(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const sources: { name: string; cert: string }[] = [];

  // 1. DATABASE_SSL_CA
  const rawCa = env.DATABASE_SSL_CA?.trim();
  if (rawCa && rawCa !== 'undefined') {
    sources.push({ name: 'DATABASE_SSL_CA', cert: validateAndNormalizePem(rawCa) });
  }

  // 2. DATABASE_SSL_CA_BASE64
  const b64Ca = env.DATABASE_SSL_CA_BASE64?.trim();
  if (b64Ca && b64Ca !== 'undefined') {
    let decoded: string;
    try {
      decoded = Buffer.from(b64Ca, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid CA certificate: malformed PEM format.');
    }
    sources.push({ name: 'DATABASE_SSL_CA_BASE64', cert: validateAndNormalizePem(decoded) });
  }

  // 3. DATABASE_SSL_CA_FILE
  const fileCa = env.DATABASE_SSL_CA_FILE?.trim();
  if (fileCa && fileCa !== 'undefined') {
    try {
      if (!fs.existsSync(fileCa)) {
        throw new Error('DATABASE_SSL_CA_FILE was not found.');
      }
      const content = fs.readFileSync(fileCa, 'utf-8');
      sources.push({ name: 'DATABASE_SSL_CA_FILE', cert: validateAndNormalizePem(content) });
    } catch (err: any) {
      if (err.message === 'Invalid CA certificate: malformed PEM format.') {
        throw err;
      }
      throw new Error('DATABASE_SSL_CA_FILE was not found.');
    }
  }

  if (sources.length === 0) {
    return undefined;
  }

  // Check if multiple sources were provided and differ
  const firstCert = sources[0].cert;
  for (let i = 1; i < sources.length; i++) {
    if (sources[i].cert !== firstCert) {
      throw new Error(
        'Multiple conflicting CA certificates provided in environment variables (DATABASE_SSL_CA, DATABASE_SSL_CA_BASE64, DATABASE_SSL_CA_FILE). Refusing to start.'
      );
    }
  }

  return firstCert;
}

export function validateTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid TEST_DATABASE_URL format.');
  }

  // Must not point to Supabase or any remote domain
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal || host.includes('supabase') || host.includes('neon')) {
    throw new Error(
      `TEST_DATABASE_URL safety check failed: Must be a local database (got host "${host}"). Never run tests or migrations against Supabase or remote databases!`
    );
  }

  // Database name must strictly end in _test
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL safety check failed: Database name "${dbName}" does not end in "_test". Refusing to run tests/migrations!`
    );
  }

  return url;
}

export const KNOWN_DEV_PLACEHOLDERS = new Set<string>([
  '',
  'changeme',
  'placeholder',
  'secret',
  'password',
  'admin123',
  'dev_secret',
  'development_secret',
  'your_secret_here',
  'your-secret-here',
  'replace_me',
  'replace-me',
  'test_jwt_secret_must_be_at_least_32_characters_long_for_security',
  'test_otp_hmac_secret_must_be_at_least_32_characters_long',
  'test_file_url_secret_must_be_at_least_32_characters_long',
  'dummy_secret_service_key',
  'cron_secret',
  'cron_super_secret_token_1234567890_abcdefg',
  'test_cron_secret',
  'short_otp_secret',
  'short_file_secret',
  'too_short_jwt',
  'test_jwt_secret',
  'test_otp_secret',
]);

function assertNotPlaceholder(name: string, val: string | undefined): void {
  if (!val || KNOWN_DEV_PLACEHOLDERS.has(val.trim())) {
    throw new Error(`Production startup check failed: ${name} equals a known development placeholder. Use a secure production secret.`);
  }
}

export function validateProductionEnv(env: Record<string, string | undefined> = process.env): void {
  // 0. Render Environment Enforcement
  if (env.RENDER === 'true' || env.RENDER === '1') {
    if (env.NODE_ENV !== 'production') {
      throw new Error(`Invalid environment: NODE_ENV must be set to "production" on Render (got "${env.NODE_ENV || 'undefined'}").`);
    }
  }

  // 1. DATABASE_URL
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  if (env.DATABASE_URL.includes(':6543')) {
    throw new Error('DATABASE_URL must use the Supabase session pooler on port 5432, not transaction pooler (:6543)');
  }

  // 2. JWT_SECRET
  assertNotPlaceholder('JWT_SECRET', env.JWT_SECRET);
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('Invalid or missing environment variable: JWT_SECRET must be at least 32 characters');
  }

  // 3. OTP_HMAC_SECRET
  assertNotPlaceholder('OTP_HMAC_SECRET', env.OTP_HMAC_SECRET);
  if (!env.OTP_HMAC_SECRET || env.OTP_HMAC_SECRET.length < 32) {
    throw new Error('Invalid or missing environment variable: OTP_HMAC_SECRET must be at least 32 characters');
  }

  // 4. FIELD_ENCRYPTION_KEY (must be exactly 32 bytes when base64 decoded)
  assertNotPlaceholder('FIELD_ENCRYPTION_KEY', env.FIELD_ENCRYPTION_KEY);
  if (!env.FIELD_ENCRYPTION_KEY || env.FIELD_ENCRYPTION_KEY.trim() === '') {
    throw new Error('Missing required environment variable: FIELD_ENCRYPTION_KEY');
  }
  try {
    const keyBuf = Buffer.from(env.FIELD_ENCRYPTION_KEY, 'base64');
    if (keyBuf.length !== 32) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid environment variable: FIELD_ENCRYPTION_KEY must be a base64 string of exactly 32 bytes');
  }

  // 5. CORS_ORIGINS (no wildcards and HTTPS only in production)
  if (!env.CORS_ORIGINS || env.CORS_ORIGINS.trim() === '') {
    throw new Error('Missing required environment variable: CORS_ORIGINS');
  }
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  if (origins.some((o) => o === '*' || o.includes('*'))) {
    throw new Error('Invalid environment variable: CORS_ORIGINS must not contain wildcard (*)');
  }
  if (origins.some((o) => o.startsWith('http://'))) {
    throw new Error('Invalid environment variable: CORS_ORIGINS must not contain insecure http:// origins in production');
  }

  // 6. Supabase settings
  if (!env.SUPABASE_URL || env.SUPABASE_URL.trim() === '') {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  assertNotPlaceholder('SUPABASE_SERVICE_KEY', env.SUPABASE_SERVICE_KEY);
  if (!env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY.trim() === '') {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_KEY');
  }

  // 7. Email settings (Brevo HTTPS or Gmail SMTP)
  const hasBrevo = env.BREVO_API_KEY && env.BREVO_API_KEY.trim() !== '';
  if (!env.GMAIL_USER || env.GMAIL_USER.trim() === '') {
    throw new Error('Missing required environment variable: GMAIL_USER (your email address used as the sender)');
  }
  if (!hasBrevo) {
    assertNotPlaceholder('GMAIL_APP_PASSWORD', env.GMAIL_APP_PASSWORD);
    if (!env.GMAIL_APP_PASSWORD || env.GMAIL_APP_PASSWORD.trim() === '') {
      throw new Error('Missing required environment variable: GMAIL_APP_PASSWORD (required when not using BREVO_API_KEY)');
    }
  }

  // 8. CRON_SECRET
  assertNotPlaceholder('CRON_SECRET', env.CRON_SECRET);
  if (!env.CRON_SECRET || env.CRON_SECRET.trim() === '') {
    throw new Error('Missing required environment variable: CRON_SECRET');
  }
  if (env.CRON_SECRET.length < 16) {
    throw new Error('Invalid environment variable: CRON_SECRET must be at least 16 characters');
  }

  // 9. FILE_URL_SECRET
  assertNotPlaceholder('FILE_URL_SECRET', env.FILE_URL_SECRET);
  if (!env.FILE_URL_SECRET || env.FILE_URL_SECRET.length < 32) {
    throw new Error('Invalid or missing environment variable: FILE_URL_SECRET must be at least 32 characters');
  }
}

if (process.env.NODE_ENV === 'test') {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_characters_long_for_security';
  process.env.OTP_HMAC_SECRET =
    process.env.OTP_HMAC_SECRET || 'test_otp_hmac_secret_must_be_at_least_32_characters_long';
} else {
  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    console.error('Environment validation errors:', parsedEnv.error.format());
    throw new Error('Invalid environment configuration');
  }
}

export const config = {
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  get PORT() {
    return Number(process.env.PORT) || 3000;
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL || '';
  },
  get TEST_DATABASE_URL() {
    return process.env.TEST_DATABASE_URL || '';
  },
  get JWT_SECRET() {
    return (
      process.env.JWT_SECRET ||
      'test_jwt_secret_must_be_at_least_32_characters_long_for_security'
    );
  },
  get OTP_HMAC_SECRET() {
    return (
      process.env.OTP_HMAC_SECRET || 'test_otp_hmac_secret_must_be_at_least_32_characters_long'
    );
  },
  get FIELD_ENCRYPTION_KEY() {
    return process.env.FIELD_ENCRYPTION_KEY || '';
  },
  get GMAIL_USER() {
    return process.env.GMAIL_USER || '';
  },
  get GMAIL_APP_PASSWORD() {
    return process.env.GMAIL_APP_PASSWORD || '';
  },
  get SUPABASE_URL() {
    return process.env.SUPABASE_URL || '';
  },
  get SUPABASE_SERVICE_KEY() {
    return process.env.SUPABASE_SERVICE_KEY || '';
  },
  get STORAGE_BUCKET() {
    return process.env.STORAGE_BUCKET || 'booyah-private';
  },
  get ADMIN_EMAIL() {
    return process.env.ADMIN_EMAIL || '';
  },
  get ADMIN_NAME() {
    return process.env.ADMIN_NAME || '';
  },
  get ADMIN_MOBILE() {
    return process.env.ADMIN_MOBILE || '';
  },
  get CRON_SECRET() {
    return process.env.CRON_SECRET || '';
  },
  get CORS_ORIGINS() {
    return (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((o) => o.trim());
  },
  get DATABASE_SSL() {
    return process.env.DATABASE_SSL === 'true';
  },
  get DATABASE_SSL_CA() {
    return resolveDatabaseSslCa(process.env) || '';
  },
  get FILE_URL_SECRET() {
    return (
      process.env.FILE_URL_SECRET ||
      'test_file_url_secret_must_be_at_least_32_characters_long'
    );
  },
  get BREVO_API_KEY() {
    return process.env.BREVO_API_KEY || '';
  },
};
