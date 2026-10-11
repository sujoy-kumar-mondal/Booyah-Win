/**
 * Storage abstraction.
 *
 * Change #2: local implementation is used ONLY when NODE_ENV is 'development'
 *            or 'test'. Any other value requires Supabase config; upload()
 *            throws immediately if it is missing (refuse-to-start behaviour).
 *
 * Change #3: local files are served through a HMAC-signed route (/api/v1/files/:key)
 *            with an expiry, never a public static folder. Key format is
 *            validated as /^[0-9a-f]{32}\.(jpg|png|webp)$/ to block path traversal.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// ─── Magic-byte validation ────────────────────────────────────────────────────

const MAGIC_CHECKS: { bytes: number[]; ext: string }[] = [
  { bytes: [0xff, 0xd8, 0xff],             ext: 'jpg'  },  // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47],       ext: 'png'  },  // PNG
  { bytes: [0x52, 0x49, 0x46, 0x46],       ext: 'webp' },  // WebP (RIFF header)
];

/**
 * Validate a buffer is a real JPEG, PNG, or WebP by checking magic bytes.
 * Returns the canonical extension ('jpg'|'png'|'webp') or throws.
 */
export function validateImageMagicBytes(buffer: Buffer): string {
  for (const { bytes, ext } of MAGIC_CHECKS) {
    if (bytes.every((b, i) => buffer[i] === b)) return ext;
  }
  throw new Error('Invalid image: file must be JPEG, PNG, or WebP');
}

/** Generate a cryptographically random filename (no user input). */
function randomName(ext: string): string {
  return `${crypto.randomBytes(16).toString('hex')}.${ext}`;
}

// ─── Local storage (development + test) ──────────────────────────────────────

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function localUpload(buffer: Buffer, ext: string): string {
  ensureUploadsDir();
  const name     = randomName(ext);
  const filePath = path.join(UPLOADS_DIR, name);
  fs.writeFileSync(filePath, buffer);
  return name; // key = filename only (32-hex + ext)
}

function localGetSignedUrl(key: string, expirySeconds: number): string {
  const expires = Date.now() + expirySeconds * 1000;
  const token   = crypto
    .createHmac('sha256', config.FILE_URL_SECRET)
    .update(`${key}:${expires}`)
    .digest('hex');
  return `/api/v1/files/${key}?token=${token}&expires=${expires}`;
}

function localDelete(key: string): void {
  const filePath = path.join(UPLOADS_DIR, key);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ─── Supabase storage (production / any non-local env) ───────────────────────

function assertSupabaseConfig(): void {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
    throw new Error(
      'Storage error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in production. ' +
      'Refusing to start without storage configuration.'
    );
  }
}

async function supabaseFetch(
  method: string,
  endpoint: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  return fetch(`${config.SUPABASE_URL}/storage/v1/${endpoint}`, {
    method,
    headers: {
      Authorization:  `Bearer ${config.SUPABASE_SERVICE_KEY}`,
      apikey:         config.SUPABASE_SERVICE_KEY,
      ...extraHeaders,
    },
    body,
  });
}

async function supabaseUpload(buffer: Buffer, ext: string): Promise<string> {
  assertSupabaseConfig();
  const bucket      = config.STORAGE_BUCKET;
  const key         = `screenshots/${randomName(ext)}`;
  const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';

  const res = await supabaseFetch('POST', `object/${bucket}/${key}`, buffer, {
    'Content-Type': contentType,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed: ${res.status} ${text}`);
  }
  return key;
}

async function supabaseGetSignedUrl(key: string, expirySeconds: number): Promise<string> {
  assertSupabaseConfig();
  const bucket = config.STORAGE_BUCKET;
  const res = await supabaseFetch(
    'POST',
    `object/sign/${bucket}/${key}`,
    JSON.stringify({ expiresIn: expirySeconds }),
    { 'Content-Type': 'application/json' }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase sign URL failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { signedURL: string };
  return `${config.SUPABASE_URL}/storage/v1${json.signedURL}`;
}

async function supabaseDelete(key: string): Promise<void> {
  assertSupabaseConfig();
  await supabaseFetch('DELETE', `object/${config.STORAGE_BUCKET}/${key}`);
}

// ─── Unified API ─────────────────────────────────────────────────────────────

const isLocal = config.NODE_ENV === 'development' || config.NODE_ENV === 'test';

/**
 * Upload a screenshot buffer.
 * Validates magic bytes and enforces the 2 MB limit.
 * Returns an opaque storage key.
 */
export async function uploadScreenshot(buffer: Buffer): Promise<string> {
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('File too large: maximum 2 MB');
  }
  const ext = validateImageMagicBytes(buffer);

  if (isLocal) return localUpload(buffer, ext);
  return supabaseUpload(buffer, ext);
}

/**
 * Get a short-lived URL for the given storage key.
 * Local: HMAC-signed path (change #3).
 * Production: Supabase signed URL.
 */
export async function getSignedUrl(key: string, expirySeconds = 60): Promise<string> {
  if (isLocal) return localGetSignedUrl(key, expirySeconds);
  return supabaseGetSignedUrl(key, expirySeconds);
}

/**
 * Delete a stored file (called on any failure path after upload – change #7).
 */
export async function deleteFile(key: string): Promise<void> {
  if (isLocal) {
    localDelete(key);
    return;
  }
  return supabaseDelete(key);
}
