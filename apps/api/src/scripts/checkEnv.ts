import crypto from 'node:crypto';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { assertDatabaseSafety } from './scriptUtils.js';

import {
  getDatabaseSslConfig,
  isUntrustedCertificateError,
  UNTRUSTED_CERT_SAFE_REASON,
} from '../db/index.js';

interface CheckResult {
  service: string;
  passed: boolean;
  message: string;
}

const { Pool } = pg;

export async function checkDatabase(overrideUrl?: string, argv: string[] = process.argv): Promise<CheckResult> {
  const service = 'Database (PostgreSQL)';
  const dbUrl = overrideUrl !== undefined ? overrideUrl : config.DATABASE_URL;

  if (!dbUrl) {
    return { service, passed: false, message: 'DATABASE_URL is not set in environment.' };
  }

  try {
    assertDatabaseSafety(dbUrl, argv);
  } catch (err: any) {
    return { service, passed: false, message: err.message };
  }

  if (dbUrl.includes(':6543')) {
    return {
      service,
      passed: false,
      message: 'DATABASE_URL uses transaction pooler port 6543. Must use session pooler port 5432.',
    };
  }

  const ssl = getDatabaseSslConfig(dbUrl);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    max: 1,
  });

  try {
    const res = await pool.query('SELECT 1 AS ok');
    if (res.rows[0]?.ok === 1) {
      return { service, passed: true, message: 'Connected and executed SELECT 1 successfully.' };
    }
    return { service, passed: false, message: 'Query executed but returned unexpected result.' };
  } catch (err: any) {
    if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
      return { service, passed: false, message: `Failed: ${UNTRUSTED_CERT_SAFE_REASON}` };
    }
    let safeError = err.code ? `PostgreSQL error code ${err.code}` : (err.message || 'Connection failed');
    try {
      const parsed = new URL(dbUrl);
      if (parsed.password) {
        safeError = safeError.replaceAll(parsed.password, '[REDACTED]');
      }
    } catch {}
    return { service, passed: false, message: `Failed: ${safeError}` };
  } finally {
    await pool.end().catch(() => {});
  }
}

export function validateStorageConfig(url?: string, bucket?: string): void {
  // Validate SUPABASE_URL
  if (!url || url.trim() === '') {
    throw new Error('Invalid or missing SUPABASE_URL: value is required.');
  }
  if (/\s/.test(url)) {
    throw new Error('Invalid SUPABASE_URL: URL contains whitespace.');
  }
  if (/[<>[\]{}]/.test(url)) {
    throw new Error('Invalid SUPABASE_URL: URL contains bracket characters.');
  }
  if (url.endsWith('/')) {
    throw new Error('Invalid SUPABASE_URL: trailing slash is not allowed.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid SUPABASE_URL: invalid URL format.');
  }
  if (parsed.pathname && parsed.pathname !== '' && parsed.pathname !== '/') {
    throw new Error('Invalid SUPABASE_URL: URL must not contain a path.');
  }

  // Validate STORAGE_BUCKET
  if (!bucket || bucket.trim() === '') {
    throw new Error('Invalid or missing STORAGE_BUCKET: bucket name is required.');
  }
  if (/\s/.test(bucket)) {
    throw new Error('Invalid STORAGE_BUCKET: bucket name contains whitespace.');
  }
  if (/[<>[\]{}]/.test(bucket)) {
    throw new Error('Invalid STORAGE_BUCKET: bucket name contains bracket characters.');
  }
  if (bucket.includes('/')) {
    throw new Error('Invalid STORAGE_BUCKET: bucket name must not contain slashes.');
  }
}

export function sanitizeErrorMessage(msg: any, secrets: (string | undefined)[] = []): string {
  let text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const secret of secrets) {
    if (secret && secret.trim().length > 0) {
      text = text.replaceAll(secret, '[REDACTED]');
    }
  }
  text = text.replace(/https?:\/\/[^\s"'<>]+/g, '[REDACTED_URL]');
  text = text.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/apikey:\s*[^\s"',]+/gi, 'apikey: [REDACTED]');
  return text;
}

const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function extractStorageErrorText(res: Response): Promise<string> {
  try {
    const json: any = await res.json();
    if (json) {
      if (typeof json.message === 'string' && json.message.trim()) {
        return json.message.trim();
      }
      if (typeof json.error === 'string' && json.error.trim()) {
        return json.error.trim();
      }
      if (typeof json.msg === 'string' && json.msg.trim()) {
        return json.msg.trim();
      }
    }
  } catch {
    try {
      const text = await res.text();
      if (text && text.trim() && !text.includes('<html')) {
        return text.trim();
      }
    } catch {}
  }
  return res.statusText || `HTTP ${res.status}`;
}

export async function checkSupabaseStorage(
  overrideUrl?: string,
  overrideKey?: string,
  overrideBucket?: string
): Promise<CheckResult> {
  const service = 'Supabase Storage';
  const url = overrideUrl !== undefined ? overrideUrl : config.SUPABASE_URL;
  const key = overrideKey !== undefined ? overrideKey : config.SUPABASE_SERVICE_KEY;
  const bucket = overrideBucket !== undefined ? overrideBucket : (config.STORAGE_BUCKET || 'booyah-private');

  try {
    validateStorageConfig(url, bucket);
  } catch (valErr: any) {
    return { service, passed: false, message: valErr.message };
  }

  if (!key || key.trim() === '') {
    return { service, passed: false, message: 'Invalid or missing SUPABASE_SERVICE_KEY: value is required.' };
  }

  const probeKey = `_healthcheck/probe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;

  // 1. Upload probe
  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${url}/storage/v1/object/${bucket}/${probeKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'image/png',
      },
      body: TINY_PNG_BUFFER,
    });
  } catch (err: any) {
    const safeErr = sanitizeErrorMessage(err.message || 'Connection failed', [key, url]);
    return { service, passed: false, message: `Upload probe failed: ${safeErr}` };
  }

  if (!uploadRes.ok) {
    const errText = await extractStorageErrorText(uploadRes);
    const safeErr = sanitizeErrorMessage(errText, [key, url]);
    return { service, passed: false, message: `Upload probe failed: ${safeErr}` };
  }

  // 2. Read-back and Cleanup
  let readError: string | null = null;
  let cleanupError: string | null = null;

  try {
    try {
      const readRes = await fetch(`${url}/storage/v1/object/${bucket}/${probeKey}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
      });

      if (!readRes.ok) {
        const errText = await extractStorageErrorText(readRes);
        readError = sanitizeErrorMessage(errText, [key, url]);
      }
    } catch (err: any) {
      readError = sanitizeErrorMessage(err.message || 'Connection failed', [key, url]);
    }
  } finally {
    // Cleanup always runs even if read back threw or failed
    try {
      const deleteRes = await fetch(`${url}/storage/v1/object/${bucket}/${probeKey}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
      });

      if (!deleteRes.ok) {
        const errText = await extractStorageErrorText(deleteRes);
        cleanupError = sanitizeErrorMessage(errText, [key, url]);
      }
    } catch (err: any) {
      cleanupError = sanitizeErrorMessage(err.message || 'Cleanup connection failed', [key, url]);
    }
  }

  if (readError && cleanupError) {
    return {
      service,
      passed: false,
      message: `Read-back probe failed: ${readError}. Additionally, cleanup delete failed: ${cleanupError} (probe file left in bucket).`,
    };
  }

  if (readError) {
    return {
      service,
      passed: false,
      message: `Read-back probe failed: ${readError}. Probe file was cleaned up successfully.`,
    };
  }

  if (cleanupError) {
    return {
      service,
      passed: false,
      message: `Probe uploaded and read back successfully, but cleanup delete failed: ${cleanupError} (probe file left in bucket).`,
    };
  }

  return {
    service,
    passed: true,
    message: `Successfully uploaded, read back, and deleted probe file in bucket '${bucket}'.`,
  };
}

export async function checkGmailSmtp(sendToEmail?: string | null, overrideUser?: string, overridePass?: string): Promise<CheckResult> {
  const service = 'Gmail SMTP';
  const user = overrideUser !== undefined ? overrideUser : config.GMAIL_USER;
  const pass = overridePass !== undefined ? overridePass : config.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return { service, passed: false, message: 'GMAIL_USER or GMAIL_APP_PASSWORD is missing.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });

  try {
    await transporter.verify();

    if (sendToEmail) {
      await transporter.sendMail({
        from: `"Booyah Win Check" <${user}>`,
        to: sendToEmail,
        subject: 'Booyah Win check:env test email',
        text: 'This is a test email sent from npm run check:env.',
      });
      return {
        service,
        passed: true,
        message: `SMTP login verified and test email sent to ${sendToEmail}.`,
      };
    }

    return {
      service,
      passed: true,
      message: 'SMTP credentials verified successfully (no email sent).',
    };
  } catch (err: any) {
    let safeError = err.response || err.code || err.message || 'Authentication failed';
    if (pass) {
      safeError = String(safeError).replaceAll(pass, '[REDACTED]');
    }
    return { service, passed: false, message: `SMTP verification failed: ${safeError}` };
  }
}

export async function run(): Promise<void> {
  console.log('====================================================');
  console.log(' Booyah Win - Live Environment Connection Check');
  console.log('====================================================\n');

  const sendToArg = process.argv.find((a) => a.startsWith('--send-to='));
  const sendToEmail = sendToArg ? sendToArg.split('=')[1].trim() : null;

  const results: CheckResult[] = [];

  // Check 1: Database
  process.stdout.write('Checking Database connection... ');
  const dbResult = await checkDatabase();
  console.log(dbResult.passed ? 'DONE' : 'FAILED');
  results.push(dbResult);

  // Check 2: Supabase Storage
  process.stdout.write('Checking Supabase Storage... ');
  const storageResult = await checkSupabaseStorage();
  console.log(storageResult.passed ? 'DONE' : 'FAILED');
  results.push(storageResult);

  // Check 3: Gmail SMTP
  process.stdout.write('Checking Gmail SMTP... ');
  const emailResult = await checkGmailSmtp(sendToEmail);
  console.log(emailResult.passed ? 'DONE' : 'FAILED');
  results.push(emailResult);

  console.log('\n---------------- RESULTS ----------------');
  let allPassed = true;
  for (const r of results) {
    const statusTag = r.passed ? '[PASS]' : '[FAIL]';
    console.log(`${statusTag} ${r.service}: ${r.message}`);
    if (!r.passed) allPassed = false;
  }
  console.log('-----------------------------------------\n');

  if (allPassed) {
    console.log('All external connections verified successfully.');
    process.exit(0);
  } else {
    console.error('One or more connection checks failed.');
    process.exit(1);
  }
}

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('checkEnv.ts') || process.argv[1].endsWith('checkEnv.js'));
if (isDirectRun) {
  run().catch((err) => {
    console.error('Unexpected check:env error:', err.message || err);
    process.exit(1);
  });
}
