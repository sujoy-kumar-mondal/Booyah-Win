import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  decryptField,
  encryptField,
  getFieldEncryptionKey,
  maskAadhaar,
  maskPan,
} from '../src/utils/encryption.js';

describe('Field Encryption & Masking Utilities', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  describe('FIELD_ENCRYPTION_KEY Environment Enforcement', () => {
    it('allows fallback dev key when NODE_ENV is "development" or "test"', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.FIELD_ENCRYPTION_KEY;
      const key = getFieldEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);

      process.env.NODE_ENV = 'development';
      const devKey = getFieldEncryptionKey();
      expect(devKey).toBeInstanceOf(Buffer);
      expect(devKey.length).toBe(32);
    });

    it('refuses to start / throws error in production if FIELD_ENCRYPTION_KEY is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FIELD_ENCRYPTION_KEY;

      expect(() => getFieldEncryptionKey()).toThrow(
        /FIELD_ENCRYPTION_KEY is required in production/
      );
    });

    it('refuses to start / throws error if FIELD_ENCRYPTION_KEY does not decode to 32 bytes', () => {
      process.env.NODE_ENV = 'production';
      // 16 bytes base64
      process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');

      expect(() => getFieldEncryptionKey()).toThrow(
        /FIELD_ENCRYPTION_KEY must be exactly 32 bytes/
      );
    });

    it('accepts valid 32-byte base64 key in production', () => {
      process.env.NODE_ENV = 'production';
      const random32 = crypto.randomBytes(32);
      process.env.FIELD_ENCRYPTION_KEY = random32.toString('base64');

      const key = getFieldEncryptionKey();
      expect(key.equals(random32)).toBe(true);
    });
  });

  describe('AES-256-GCM Encryption / Decryption Round Trip', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('successfully encrypts and decrypts PAN and Aadhaar strings', () => {
      const pan = 'ABCDE1234F';
      const aadhaar = '987654321098';

      const panEnc = encryptField(pan);
      const aadhaarEnc = encryptField(aadhaar);

      expect(panEnc).toBeInstanceOf(Buffer);
      expect(panEnc.toString('utf8')).not.toBe(pan);

      const decryptedPan = decryptField(panEnc);
      const decryptedAadhaar = decryptField(aadhaarEnc);

      expect(decryptedPan).toBe(pan);
      expect(decryptedAadhaar).toBe(aadhaar);
    });

    it('returns null for null or empty buffer', () => {
      expect(decryptField(null)).toBeNull();
      expect(decryptField(undefined)).toBeNull();
      expect(decryptField(Buffer.alloc(0))).toBeNull();
    });
  });

  describe('Masking Rules (Rule #3)', () => {
    it('masks PAN showing only last 4 characters: ABCDE1234F -> XXXXXX234F', () => {
      expect(maskPan('ABCDE1234F')).toBe('XXXXXX234F');
      expect(maskPan('XYZAB9876Q')).toBe('XXXXXX876Q');
      expect(maskPan(null)).toBeNull();
      expect(maskPan('')).toBeNull();
    });

    it('masks Aadhaar showing only last 4 digits: 123456789012 -> XXXX XXXX 9012', () => {
      expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
      expect(maskAadhaar('987654321098')).toBe('XXXX XXXX 1098');
      expect(maskAadhaar(null)).toBeNull();
      expect(maskAadhaar('')).toBeNull();
    });
  });
});
