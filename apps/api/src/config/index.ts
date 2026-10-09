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
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
});

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
};
