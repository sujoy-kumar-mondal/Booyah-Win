import dotenv from 'dotenv';
import path from 'path';
import { beforeAll, afterAll } from 'vitest';

// Load .env from booyah-win project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

process.env.NODE_ENV = 'test';

import { validateTestDatabaseUrl } from '../src/config/index.js';
import { closePool, query } from '../src/db/index.js';
import { runTestMigrations } from '../src/scripts/runTestMigrations.js';

beforeAll(async () => {
  // Validate safety checks
  validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

  // Run schema migration on test database
  await runTestMigrations();
});

afterAll(async () => {
  await closePool();
});

export async function truncateAllTables(): Promise<void> {
  // Truncate tables in reverse dependency order
  await query(`
    TRUNCATE TABLE
      audit_logs,
      referrals,
      match_results,
      match_players,
      team_invites,
      teams,
      matches,
      tier_position_prizes,
      entry_tiers,
      withdrawal_requests,
      deposit_requests,
      wallet_ledger,
      wallets,
      sessions,
      otp_requests,
      users,
      staff,
      app_settings
    RESTART IDENTITY CASCADE;
  `);
}
