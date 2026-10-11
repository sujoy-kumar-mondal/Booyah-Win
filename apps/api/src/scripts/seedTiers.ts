import { closePool } from '../db/index.js';
import { TierService } from '../modules/admin/tiers/tier.service.js';

export async function seedTiers(): Promise<void> {
  console.log('Seeding default entry tiers (Section 10.2)...');
  await TierService.seedDefaultTiers();
  console.log('Default entry tiers successfully seeded.');
}

if (process.argv[1]?.includes('seedTiers')) {
  seedTiers()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Failed to seed tiers:', err.message);
      await closePool();
      process.exit(1);
    });
}
