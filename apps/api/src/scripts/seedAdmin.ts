import { mobileSchema, nameSchema, emailSchema } from '@booyah/shared';
import { config } from '../config/index.js';
import { closePool, query, isUntrustedCertificateError, UNTRUSTED_CERT_SAFE_REASON } from '../db/index.js';
import { assertDatabaseSafety } from './scriptUtils.js';

export async function seedAdmin(): Promise<void> {
  const targetDb = config.NODE_ENV === 'test' ? (config.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL) : (config.DATABASE_URL || process.env.DATABASE_URL);
  assertDatabaseSafety(targetDb);
  const emailVal = config.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const nameVal = config.ADMIN_NAME || process.env.ADMIN_NAME;
  const mobileVal = config.ADMIN_MOBILE || process.env.ADMIN_MOBILE;

  if (!emailVal) {
    throw new Error('ADMIN_EMAIL is required in environment to seed admin.');
  }
  const emailParsed = emailSchema.safeParse(emailVal);
  if (!emailParsed.success) {
    throw new Error(`ADMIN_EMAIL is invalid: ${emailParsed.error.message}`);
  }
  const email = emailParsed.data;

  if (!nameVal) {
    throw new Error('ADMIN_NAME is required in environment to seed admin.');
  }
  const nameParsed = nameSchema.safeParse(nameVal);
  if (!nameParsed.success) {
    throw new Error(`ADMIN_NAME is invalid: ${nameParsed.error.message}`);
  }
  const name = nameParsed.data;

  // Requirement #4: seed:admin must require ADMIN_MOBILE (valid 10-digit Indian mobile) and fail with a clear error if missing
  if (!mobileVal) {
    throw new Error(
      'ADMIN_MOBILE is required in environment to seed admin (must be a valid 10-digit Indian mobile).'
    );
  }
  const mobileParsed = mobileSchema.safeParse(mobileVal);
  if (!mobileParsed.success) {
    throw new Error(
      `ADMIN_MOBILE is invalid: ${mobileParsed.error.errors[0]?.message || 'Must be a 10-digit Indian mobile'}`
    );
  }
  const mobile = mobileParsed.data;

  // Check if admin already exists
  const existing = await query(
    `SELECT id, email, role FROM staff WHERE email = $1 OR role = 'admin'`,
    [email]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`Admin account already exists (${existing.rows[0].email}). No action taken.`);
    return;
  }

  // Insert admin
  await query(
    `INSERT INTO staff (role, name, email, mobile)
     VALUES ('admin', $1, $2, $3)`,
    [name, email, mobile]
  );

  console.log(`Admin account successfully seeded for ${email}.`);
}

// If executed directly from CLI
if (process.argv[1]?.includes('seedAdmin')) {
  seedAdmin()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
        console.error(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        console.error('Failed to seed admin:', err.message);
      }
      await closePool();
      process.exit(1);
    });
}
