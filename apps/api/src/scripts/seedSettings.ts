import { closePool, isUntrustedCertificateError, UNTRUSTED_CERT_SAFE_REASON } from '../db/index.js';
import { SettingsService } from '../modules/admin/settings/settings.service.js';
import { config } from '../config/index.js';
import { assertDatabaseSafety } from './scriptUtils.js';

export async function seedSettings(): Promise<void> {
  const targetDb = config.NODE_ENV === 'test' ? (config.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL) : (config.DATABASE_URL || process.env.DATABASE_URL);
  assertDatabaseSafety(targetDb);
  console.log('Seeding default app_settings...');
  await SettingsService.seedDefaults();
  console.log('Default settings successfully seeded.');
}

if (process.argv[1]?.includes('seedSettings')) {
  seedSettings()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      if (isUntrustedCertificateError(err) || err.message === UNTRUSTED_CERT_SAFE_REASON) {
        console.error(UNTRUSTED_CERT_SAFE_REASON);
      } else {
        console.error('Failed to seed settings:', err.message);
      }
      await closePool();
      process.exit(1);
    });
}
