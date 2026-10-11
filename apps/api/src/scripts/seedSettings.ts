import { closePool } from '../db/index.js';
import { SettingsService } from '../modules/admin/settings/settings.service.js';

export async function seedSettings(): Promise<void> {
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
      console.error('Failed to seed settings:', err.message);
      await closePool();
      process.exit(1);
    });
}
