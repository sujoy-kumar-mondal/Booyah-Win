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

    // 1b. Ensure citext is located in the extensions schema
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_extension 
          WHERE extname = 'citext' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ) THEN
          CREATE SCHEMA IF NOT EXISTS extensions;
          ALTER EXTENSION citext SET SCHEMA extensions;
        END IF;
      END $$;
    `);

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

    // 8. Ensure 'all' is an allowed value in wallet_kind
    try {
      await client.query("ALTER TYPE wallet_kind ADD VALUE IF NOT EXISTS 'all'");
    } catch {
      // Ignore if already exists or not supported
    }

    // 8b. Ensure 'joining_reward' is an allowed value in ledger_type
    try {
      await client.query("ALTER TYPE ledger_type ADD VALUE IF NOT EXISTS 'joining_reward'");
    } catch {
      // Ignore if already exists or not supported
    }

    // 8c. Ensure 'lone_wolf' is an allowed value in game_mode
    try {
      await client.query("ALTER TYPE game_mode ADD VALUE IF NOT EXISTS 'lone_wolf'");
    } catch {
      // Ignore if already exists or not supported
    }

    // 8c. Ensure 'joining_reward' and 'referral_reward' default settings exist
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') THEN
          INSERT INTO app_settings (key, value)
          VALUES ('joining_reward', '0.00')
          ON CONFLICT (key) DO NOTHING;

          INSERT INTO app_settings (key, value)
          VALUES ('referral_reward', '5.00')
          ON CONFLICT (key) DO NOTHING;

          INSERT INTO app_settings (key, value)
          VALUES
            ('leaderboard_last_weekly_refresh', ''),
            ('leaderboard_last_monthly_refresh', ''),
            ('leaderboard_last_overall_refresh', ''),
            ('match_rules_cs_image_url', ''),
            ('match_rules_cs_image_key', ''),
            ('match_rules_lw_image_url', ''),
            ('match_rules_lw_image_key', ''),
            ('match_rules_lw_en', ''),
            ('match_rules_lw_bn', ''),
            ('invitation_text', E'Hey, Download Booyah Win - Play Free Fire Tournaments & Win Money\\nJoin tournaments, show your skills and win real cash prizes!'),
            ('community_youtube', 'https://youtube.com/@booyahwin')
          ON CONFLICT (key) DO NOTHING;
        END IF;
      END $$;
    `);

    // 9. Record in pgmigrations if present
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

    // 9. Ensure notifications table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id            BIGSERIAL PRIMARY KEY,
        user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
        type          VARCHAR(50) NOT NULL,
        title         TEXT NOT NULL,
        message       TEXT NOT NULL,
        action_url    TEXT,
        metadata      JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id            BIGSERIAL PRIMARY KEY,
        user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
        endpoint      TEXT NOT NULL UNIQUE,
        p256dh        TEXT NOT NULL,
        auth          TEXT NOT NULL,
        user_agent    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      DROP INDEX IF EXISTS push_subscriptions_user_id_index;
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

      CREATE TABLE IF NOT EXISTS device_tokens (
        id         BIGSERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token  TEXT NOT NULL UNIQUE,
        platform   VARCHAR(32) NOT NULL DEFAULT 'android',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens (user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_fcm_token ON device_tokens (fcm_token);
    `);

    // 10. Ensure staff table uses prefixed string IDs
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'staff' AND column_name = 'id' AND data_type != 'text'
        ) THEN
          CREATE SEQUENCE IF NOT EXISTS staff_id_seq START 1;

          -- Drop FK constraints referencing staff(id)
          DECLARE
            r RECORD;
          BEGIN
            FOR r IN (
              SELECT tc.table_name, tc.constraint_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'staff'
                AND ccu.column_name = 'id'
            ) LOOP
              EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            END LOOP;
          END;

          ALTER TABLE staff ALTER COLUMN created_by TYPE TEXT USING (
            CASE WHEN created_by IS NULL THEN NULL
                 WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
                 ELSE 'BW-STF-' || created_by::text
            END
          );
          ALTER TABLE users ALTER COLUMN deleted_by TYPE TEXT USING (
            CASE WHEN deleted_by IS NULL THEN NULL
                 WHEN deleted_by::text LIKE 'BW-STF-%' THEN deleted_by::text
                 ELSE 'BW-STF-' || deleted_by::text
            END
          );
          ALTER TABLE deposit_requests ALTER COLUMN reviewed_by TYPE TEXT USING (
            CASE WHEN reviewed_by IS NULL THEN NULL
                 WHEN reviewed_by::text LIKE 'BW-STF-%' THEN reviewed_by::text
                 ELSE 'BW-STF-' || reviewed_by::text
            END
          );
          ALTER TABLE deposit_requests ALTER COLUMN employee_reviewed_by TYPE TEXT USING (
            CASE WHEN employee_reviewed_by IS NULL THEN NULL
                 WHEN employee_reviewed_by::text LIKE 'BW-STF-%' THEN employee_reviewed_by::text
                 ELSE 'BW-STF-' || employee_reviewed_by::text
            END
          );
          ALTER TABLE withdrawal_requests ALTER COLUMN processed_by TYPE TEXT USING (
            CASE WHEN processed_by IS NULL THEN NULL
                 WHEN processed_by::text LIKE 'BW-STF-%' THEN processed_by::text
                 ELSE 'BW-STF-' || processed_by::text
            END
          );
          ALTER TABLE withdrawal_requests ALTER COLUMN employee_reviewed_by TYPE TEXT USING (
            CASE WHEN employee_reviewed_by IS NULL THEN NULL
                 WHEN employee_reviewed_by::text LIKE 'BW-STF-%' THEN employee_reviewed_by::text
                 ELSE 'BW-STF-' || employee_reviewed_by::text
            END
          );
          ALTER TABLE matches ALTER COLUMN created_by TYPE TEXT USING (
            CASE WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
                 ELSE 'BW-STF-' || created_by::text
            END
          );
          ALTER TABLE match_results ALTER COLUMN submitted_by TYPE TEXT USING (
            CASE WHEN submitted_by::text LIKE 'BW-STF-%' THEN submitted_by::text
                 ELSE 'BW-STF-' || submitted_by::text
            END
          );
          ALTER TABLE match_results ALTER COLUMN approved_by TYPE TEXT USING (
            CASE WHEN approved_by IS NULL THEN NULL
                 WHEN approved_by::text LIKE 'BW-STF-%' THEN approved_by::text
                 ELSE 'BW-STF-' || approved_by::text
            END
          );
          ALTER TABLE audit_logs ALTER COLUMN staff_id TYPE TEXT USING (
            CASE WHEN staff_id IS NULL THEN NULL
                 WHEN staff_id::text LIKE 'BW-STF-%' THEN staff_id::text
                 ELSE 'BW-STF-' || staff_id::text
            END
          );
          ALTER TABLE app_settings ALTER COLUMN updated_by TYPE TEXT USING (
            CASE WHEN updated_by IS NULL THEN NULL
                 WHEN updated_by::text LIKE 'BW-STF-%' THEN updated_by::text
                 ELSE 'BW-STF-' || updated_by::text
            END
          );

          ALTER TABLE staff ALTER COLUMN id DROP DEFAULT;
          ALTER TABLE staff ALTER COLUMN id TYPE TEXT USING (
            CASE WHEN id::text LIKE 'BW-STF-%' THEN id::text
                 ELSE 'BW-STF-' || id::text
            END
          );
          ALTER TABLE staff ALTER COLUMN id SET DEFAULT ('BW-STF-' || nextval('staff_id_seq')::text);

          DECLARE
            max_s bigint;
          BEGIN
            SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-STF-', ''), '')::bigint), 0) INTO max_s FROM staff;
            IF max_s > 0 THEN
              PERFORM setval('staff_id_seq', max_s, true);
            ELSE
              PERFORM setval('staff_id_seq', 1, false);
            END IF;
          END;

          UPDATE sessions SET account_id = 'BW-STF-' || account_id WHERE account_type = 'staff' AND account_id NOT LIKE 'BW-STF-%';
          UPDATE audit_logs SET target_id = 'BW-STF-' || target_id WHERE target_type IN ('employee', 'staff') AND target_id IS NOT NULL AND target_id NOT LIKE 'BW-STF-%';
          UPDATE wallet_ledger SET ref_id = 'BW-STF-' || regexp_replace(ref_id, '^(?:BW-)?(?:STF-)?', '') WHERE (type = 'admin_adjustment' OR ref_type = 'admin_adjustment') AND ref_id IS NOT NULL AND ref_id NOT LIKE 'BW-STF-%';

          ALTER TABLE staff ADD CONSTRAINT staff_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE users ADD CONSTRAINT users_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_employee_reviewed_by_fkey FOREIGN KEY (employee_reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_employee_reviewed_by_fkey FOREIGN KEY (employee_reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE matches ADD CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE;
          ALTER TABLE match_results ADD CONSTRAINT match_results_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES staff(id) ON UPDATE CASCADE;
          ALTER TABLE match_results ADD CONSTRAINT match_results_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
          ALTER TABLE app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 11. Ensure unified sequence 'wallet_ledger_id_seq' for deposit_requests, withdrawal_requests, and wallet_ledger
    await client.query(`
      DO $$
      DECLARE
        max_l bigint := 0;
        max_d bigint := 0;
        max_w bigint := 0;
        max_all bigint := 0;
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_ledger') THEN
          ALTER TABLE wallet_ledger ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);
          ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);
          ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);

          SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_l FROM wallet_ledger;
          SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_d FROM deposit_requests;
          SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_w FROM withdrawal_requests;
          max_all := GREATEST(max_l, max_d, max_w);
          IF max_all > 0 THEN
            PERFORM setval('wallet_ledger_id_seq', max_all, true);
          ELSE
            PERFORM setval('wallet_ledger_id_seq', 1, false);
          END IF;
        END IF;
      END $$;
    `);

    // 12. Ensure audit_logs stores standard prefixed IDs (BW-STF-<id> and BW-USR-<id>)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
          -- 12a. Prefix staff_id column
          UPDATE audit_logs
          SET staff_id = 'BW-STF-' || regexp_replace(staff_id, '^(?:BW-)?(?:STF-)?', '')
          WHERE staff_id IS NOT NULL AND staff_id NOT LIKE 'BW-STF-%';

          -- 12b. Prefix target_id column for user and staff target types
          UPDATE audit_logs
          SET target_id = 'BW-USR-' || regexp_replace(target_id, '^(?:BW-)?(?:USR-)?', '')
          WHERE target_type = 'user' AND target_id IS NOT NULL AND target_id NOT LIKE 'BW-USR-%';

          UPDATE audit_logs
          SET target_id = 'BW-STF-' || regexp_replace(target_id, '^(?:BW-)?(?:STF-)?', '')
          WHERE target_type IN ('staff', 'employee') AND target_id IS NOT NULL AND target_id NOT LIKE 'BW-STF-%';

          -- 12c. Prefix user and staff IDs within details JSON payload
          UPDATE audit_logs
          SET details = jsonb_set(
            details::jsonb,
            '{userId}',
            to_jsonb('BW-USR-' || regexp_replace(details::jsonb->>'userId', '^(?:BW-)?(?:USR-)?', ''))
          )
          WHERE details IS NOT NULL
            AND details::jsonb ? 'userId'
            AND details::jsonb->>'userId' NOT LIKE 'BW-USR-%';

          UPDATE audit_logs
          SET details = jsonb_set(
            details::jsonb,
            '{adminId}',
            to_jsonb('BW-STF-' || regexp_replace(details::jsonb->>'adminId', '^(?:BW-)?(?:STF-)?', ''))
          )
          WHERE details IS NOT NULL
            AND details::jsonb ? 'adminId'
            AND details::jsonb->>'adminId' NOT LIKE 'BW-STF-%';

          UPDATE audit_logs
          SET details = jsonb_set(
            details::jsonb,
            '{staffId}',
            to_jsonb('BW-STF-' || regexp_replace(details::jsonb->>'staffId', '^(?:BW-)?(?:STF-)?', ''))
          )
          WHERE details IS NOT NULL
            AND details::jsonb ? 'staffId'
            AND details::jsonb->>'staffId' NOT LIKE 'BW-STF-%';

          UPDATE audit_logs
          SET details = jsonb_set(
            details::jsonb,
            '{deletedBy}',
            to_jsonb('BW-STF-' || regexp_replace(details::jsonb->>'deletedBy', '^(?:BW-)?(?:STF-)?', ''))
          )
          WHERE details IS NOT NULL
            AND details::jsonb ? 'deletedBy'
            AND details::jsonb->>'deletedBy' NOT LIKE 'BW-STF-%';
        END IF;
      END $$;
    `);

    // 11. Staff notifications and push subscriptions
    await client.query(`
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff ON push_subscriptions (staff_id);

      CREATE TABLE IF NOT EXISTS staff_notifications (
        id            BIGSERIAL PRIMARY KEY,
        target_role   VARCHAR(20) NOT NULL DEFAULT 'all',
        staff_id      TEXT REFERENCES staff(id) ON DELETE CASCADE,
        type          VARCHAR(50) NOT NULL,
        title         TEXT NOT NULL,
        message       TEXT NOT NULL,
        action_url    TEXT,
        metadata      JSONB,
        is_read       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_staff_notifications_role_created ON staff_notifications (target_role, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_staff_notifications_staff_created ON staff_notifications (staff_id, created_at DESC);
    `);

    // 12. Ensure withdrawal_requests amount check constraint allows amounts > 0 (limits governed by app_settings)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawal_requests') THEN
          ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;
          ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_amount_check CHECK (amount > 0);
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
