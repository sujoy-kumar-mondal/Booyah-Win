import crypto from 'node:crypto';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

interface CheckResult {
  service: string;
  passed: boolean;
  message: string;
}

const { Pool } = pg;

export async function checkDatabase(overrideUrl?: string): Promise<CheckResult> {
  const service = 'Database (PostgreSQL)';
  const dbUrl = overrideUrl !== undefined ? overrideUrl : config.DATABASE_URL;

  if (!dbUrl) {
    return { service, passed: false, message: 'DATABASE_URL is not set in environment.' };
  }

  if (dbUrl.includes(':6543')) {
    return {
      service,
      passed: false,
      message: 'DATABASE_URL uses transaction pooler port 6543. Must use session pooler port 5432.',
    };
  }

  let ssl: pg.PoolConfig['ssl'] | undefined = undefined;
  const isRemote =
    !dbUrl.includes('localhost') &&
    !dbUrl.includes('127.0.0.1') &&
    !dbUrl.includes('::1');

  if (config.DATABASE_SSL || isRemote) {
    ssl = {
      rejectUnauthorized: true,
      ca: config.DATABASE_SSL_CA ? config.DATABASE_SSL_CA : undefined,
    };
  }

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
    const safeError = err.code ? `PostgreSQL error code ${err.code}` : (err.message || 'Connection failed');
    return { service, passed: false, message: `Failed: ${safeError}` };
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function checkSupabaseStorage(overrideUrl?: string, overrideKey?: string): Promise<CheckResult> {
  const service = 'Supabase Storage';
  const url = overrideUrl !== undefined ? overrideUrl : config.SUPABASE_URL;
  const key = overrideKey !== undefined ? overrideKey : config.SUPABASE_SERVICE_KEY;
  const bucket = config.STORAGE_BUCKET || 'booyah-private';

  if (!url || !key) {
    return { service, passed: false, message: 'SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.' };
  }

  const probeKey = `screenshots/.probe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.txt`;
  const probeContent = Buffer.from('booyah-win-storage-probe');

  try {
    // 1. Upload probe
    const uploadRes = await fetch(`${url}/storage/v1/object/${bucket}/${probeKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'text/plain',
      },
      body: probeContent,
    });

    if (!uploadRes.ok) {
      const status = uploadRes.status;
      return { service, passed: false, message: `Upload probe failed with HTTP status ${status}.` };
    }

    // 2. Delete probe
    const deleteRes = await fetch(`${url}/storage/v1/object/${bucket}/${probeKey}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });

    if (!deleteRes.ok) {
      return {
        service,
        passed: false,
        message: `Probe uploaded, but cleanup delete returned HTTP status ${deleteRes.status}.`,
      };
    }

    return {
      service,
      passed: true,
      message: `Successfully uploaded and deleted probe file in bucket '${bucket}'.`,
    };
  } catch (err: any) {
    const safeMsg = err.message ? err.message.replace(key, '[REDACTED]') : 'Network or connection error';
    return { service, passed: false, message: `Storage probe failed: ${safeMsg}` };
  }
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
    const safeError = err.response || err.code || err.message || 'Authentication failed';
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
