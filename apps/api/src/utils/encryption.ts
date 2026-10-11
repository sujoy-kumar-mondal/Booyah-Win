import crypto from 'crypto';
import { config } from '../config/index.js';

export function getFieldEncryptionKey(): Buffer {
  const envKey = process.env.FIELD_ENCRYPTION_KEY || config.FIELD_ENCRYPTION_KEY;
  const isDevOrTest =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    config.NODE_ENV === 'development' ||
    config.NODE_ENV === 'test';

  if (!envKey) {
    if (isDevOrTest) {
      // 32-byte fallback key for dev and test only
      return Buffer.from('booyahwin_dev_encryption_key_32b', 'utf8');
    }
    throw new Error(
      'FIELD_ENCRYPTION_KEY is required in production and must decode to exactly 32 bytes (base64).'
    );
  }

  const decoded = Buffer.from(envKey, 'base64');
  if (decoded.length !== 32) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be exactly 32 bytes when base64 decoded (got ${decoded.length} bytes).`
    );
  }

  return decoded;
}

/**
 * Encrypts a string using AES-256-GCM.
 * Packed format: [12-byte IV][16-byte AuthTag][Ciphertext]
 */
export function encryptField(plaintext: string): Buffer {
  const key = getFieldEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts a buffer encrypted with AES-256-GCM.
 */
export function decryptField(encryptedBuffer: Buffer | null | undefined): string | null {
  if (!encryptedBuffer || encryptedBuffer.length < 28) {
    return null;
  }

  const key = getFieldEncryptionKey();
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const ciphertext = encryptedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Masks PAN: last 4 characters visible, first 6 masked (e.g. ABCDE1234F -> XXXXXX234F)
 */
export function maskPan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  const clean = pan.trim();
  if (clean.length < 4) return clean;
  const last4 = clean.slice(-4);
  const prefixLength = clean.length - 4;
  return `${'X'.repeat(prefixLength)}${last4}`;
}

/**
 * Masks Aadhaar: last 4 digits visible (e.g. 123456789012 -> XXXX XXXX 9012)
 */
export function maskAadhaar(aadhaar: string | null | undefined): string | null {
  if (!aadhaar) return null;
  const clean = aadhaar.trim();
  if (clean.length < 4) return clean;
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
}
