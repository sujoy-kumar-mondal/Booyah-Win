import pg from 'pg';
import { getPool } from './index.js';
import { logger } from '../utils/logger.js';

export async function ensureDatabaseSchema(targetPool: pg.Pool = getPool()): Promise<void> {
  const client = await targetPool.connect();
  try {
    // 1. Check if core tables exist before applying updates
    const usersTableCheck = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
    );
    if (usersTableCheck.rowCount === 0) {
      // Tables have not been created yet; skip schema synchronization
      return;
    }

    logger.info('Verifying database schema synchronization...');

    // 2. Ensure users.language column exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'language'
        ) THEN
          ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'bn'));
        END IF;
      END $$;
    `);

    // 3. Ensure users.avatar_key column exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;
    `);

    // 4. Ensure sessions columns exist
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
          ALTER TABLE sessions
            ADD COLUMN IF NOT EXISTS last_otp_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ADD COLUMN IF NOT EXISTS elevated_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour');
        END IF;
      END $$;
    `);

    // 5. Ensure otp_requests constraint allows 'step_up'
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'otp_requests') THEN
          ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS otp_requests_purpose_check;
          ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_purpose_check CHECK (purpose IN ('register', 'login', 'step_up'));
        END IF;
      END $$;
    `);

    // 6. Ensure app_settings defaults
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') THEN
          INSERT INTO app_settings (key, value)
          VALUES ('cashback_max_percent', '5')
          ON CONFLICT (key) DO NOTHING;

          INSERT INTO app_settings (key, value)
          VALUES
            ('maintenance_enabled', 'false'),
            ('maintenance_message', 'Under scheduled maintenance. Please check back shortly.'),
            ('maintenance_until', '')
          ON CONFLICT (key) DO NOTHING;
        END IF;
      END $$;
    `);

    // 7. Ensure wallet_ledger composite index
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_ledger') THEN
          CREATE INDEX IF NOT EXISTS wallet_ledger_type_created_at_idx
            ON wallet_ledger (type, created_at);
        END IF;
      END $$;
    `);

    // 8. Record in pgmigrations if present
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pgmigrations') THEN
          INSERT INTO pgmigrations (name, run_on)
          SELECT '1710000000010_user-language', NOW()
          WHERE NOT EXISTS (SELECT 1 FROM pgmigrations WHERE name = '1710000000010_user-language');
        END IF;
      END $$;
    `);

    logger.info('Database schema verified and synchronized successfully.');
  } catch (err: any) {
    logger.error({ err: err.message }, 'Warning: Database schema verification encountered an issue');
  } finally {
    client.release();
  }
}
