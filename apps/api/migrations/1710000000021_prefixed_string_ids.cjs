/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Ensure sequences exist for the 5 entity tables
    CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS matches_id_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS deposit_requests_id_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS withdrawal_requests_id_seq START 1;
    CREATE SEQUENCE IF NOT EXISTS wallet_ledger_id_seq START 1;

    -- 2. Drop all foreign key constraints referencing users(id) and matches(id)
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_referred_by_fkey;
    ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
    ALTER TABLE deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_user_id_fkey;
    ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey;
    ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_user_id_fkey;
    ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;
    ALTER TABLE team_invites DROP CONSTRAINT IF EXISTS team_invites_invited_user_id_fkey;
    ALTER TABLE match_players DROP CONSTRAINT IF EXISTS match_players_user_id_fkey;
    ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;
    ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

    ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_match_id_fkey;
    ALTER TABLE match_players DROP CONSTRAINT IF EXISTS match_players_match_id_fkey;
    ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_match_id_fkey;

    -- 3. Alter child/referencing columns from BIGINT to TEXT (prefixing existing data)
    ALTER TABLE users ALTER COLUMN referred_by TYPE TEXT USING (
      CASE WHEN referred_by IS NULL THEN NULL
           WHEN referred_by::text LIKE 'BW-USR-%' THEN referred_by::text
           ELSE 'BW-USR-' || referred_by::text
      END
    );

    ALTER TABLE wallets ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE deposit_requests ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE withdrawal_requests ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE wallet_ledger ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE teams ALTER COLUMN leader_id TYPE TEXT USING (
      CASE WHEN leader_id::text LIKE 'BW-USR-%' THEN leader_id::text
           ELSE 'BW-USR-' || leader_id::text
      END
    );

    ALTER TABLE team_invites ALTER COLUMN invited_user_id TYPE TEXT USING (
      CASE WHEN invited_user_id::text LIKE 'BW-USR-%' THEN invited_user_id::text
           ELSE 'BW-USR-' || invited_user_id::text
      END
    );

    ALTER TABLE match_players ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE referrals ALTER COLUMN referrer_id TYPE TEXT USING (
      CASE WHEN referrer_id::text LIKE 'BW-USR-%' THEN referrer_id::text
           ELSE 'BW-USR-' || referrer_id::text
      END
    );

    ALTER TABLE referrals ALTER COLUMN referred_id TYPE TEXT USING (
      CASE WHEN referred_id::text LIKE 'BW-USR-%' THEN referred_id::text
           ELSE 'BW-USR-' || referred_id::text
      END
    );

    ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id IS NULL THEN NULL
           WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE push_subscriptions ALTER COLUMN user_id TYPE TEXT USING (
      CASE WHEN user_id IS NULL THEN NULL
           WHEN user_id::text LIKE 'BW-USR-%' THEN user_id::text
           ELSE 'BW-USR-' || user_id::text
      END
    );

    ALTER TABLE sessions ALTER COLUMN account_id TYPE TEXT USING (
      CASE WHEN account_type = 'user' AND account_id::text NOT LIKE 'BW-USR-%'
           THEN 'BW-USR-' || account_id::text
           ELSE account_id::text
      END
    );

    ALTER TABLE audit_logs ALTER COLUMN target_id TYPE TEXT USING target_id::text;

    -- 3b. Alter match foreign key columns
    ALTER TABLE teams ALTER COLUMN match_id TYPE TEXT USING (
      CASE WHEN match_id::text LIKE 'BW-MCH-%' THEN match_id::text
           ELSE 'BW-MCH-' || match_id::text
      END
    );

    ALTER TABLE match_players ALTER COLUMN match_id TYPE TEXT USING (
      CASE WHEN match_id::text LIKE 'BW-MCH-%' THEN match_id::text
           ELSE 'BW-MCH-' || match_id::text
      END
    );

    ALTER TABLE match_results ALTER COLUMN match_id TYPE TEXT USING (
      CASE WHEN match_id::text LIKE 'BW-MCH-%' THEN match_id::text
           ELSE 'BW-MCH-' || match_id::text
      END
    );

    ALTER TABLE wallet_ledger ALTER COLUMN ref_id TYPE TEXT USING (
      CASE WHEN ref_id IS NULL THEN NULL
           WHEN ref_id::text LIKE 'BW-%' THEN ref_id::text
           WHEN ref_type = 'match' THEN 'BW-MCH-' || ref_id::text
           WHEN ref_type = 'deposit' THEN 'BW-DPT-' || ref_id::text
           WHEN ref_type = 'withdrawal' THEN 'BW-WDL-' || ref_id::text
           ELSE ref_id::text
      END
    );

    -- 3c. Alter primary key columns to TEXT
    ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-USR-%' THEN id::text
           ELSE 'BW-USR-' || id::text
      END
    );

    ALTER TABLE matches ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE matches ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-MCH-%' THEN id::text
           ELSE 'BW-MCH-' || id::text
      END
    );

    ALTER TABLE deposit_requests ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE deposit_requests ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-DPT-%' THEN id::text
           ELSE 'BW-DPT-' || id::text
      END
    );

    ALTER TABLE withdrawal_requests ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE withdrawal_requests ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-WDL-%' THEN id::text
           ELSE 'BW-WDL-' || id::text
      END
    );

    ALTER TABLE wallet_ledger ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE wallet_ledger ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-TRX-%' THEN id::text
           ELSE 'BW-TRX-' || id::text
      END
    );

    -- 4. Set column defaults using sequences
    ALTER TABLE users ALTER COLUMN id SET DEFAULT ('BW-USR-' || nextval('users_id_seq')::text);
    ALTER TABLE matches ALTER COLUMN id SET DEFAULT ('BW-MCH-' || nextval('matches_id_seq')::text);
    ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-DPT-' || nextval('deposit_requests_id_seq')::text);
    ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-WDL-' || nextval('withdrawal_requests_id_seq')::text);
    ALTER TABLE wallet_ledger ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);

    -- 5. Synchronize sequences with existing data
    DO $$
    DECLARE
      max_u bigint;
      max_m bigint;
      max_d bigint;
      max_w bigint;
      max_l bigint;
    BEGIN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-USR-', ''), '')::bigint), 0) INTO max_u FROM users;
      IF max_u > 0 THEN
        PERFORM setval('users_id_seq', max_u, true);
      ELSE
        PERFORM setval('users_id_seq', 1, false);
      END IF;

      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-MCH-', ''), '')::bigint), 0) INTO max_m FROM matches;
      IF max_m > 0 THEN
        PERFORM setval('matches_id_seq', max_m, true);
      ELSE
        PERFORM setval('matches_id_seq', 1, false);
      END IF;

      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-DPT-', ''), '')::bigint), 0) INTO max_d FROM deposit_requests;
      IF max_d > 0 THEN
        PERFORM setval('deposit_requests_id_seq', max_d, true);
      ELSE
        PERFORM setval('deposit_requests_id_seq', 1, false);
      END IF;

      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-WDL-', ''), '')::bigint), 0) INTO max_w FROM withdrawal_requests;
      IF max_w > 0 THEN
        PERFORM setval('withdrawal_requests_id_seq', max_w, true);
      ELSE
        PERFORM setval('withdrawal_requests_id_seq', 1, false);
      END IF;

      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_l FROM wallet_ledger;
      IF max_l > 0 THEN
        PERFORM setval('wallet_ledger_id_seq', max_l, true);
      ELSE
        PERFORM setval('wallet_ledger_id_seq', 1, false);
      END IF;
    END $$;

    -- 6. Re-create foreign key constraints
    ALTER TABLE users ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE teams ADD CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE team_invites ADD CONSTRAINT team_invites_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE match_players ADD CONSTRAINT match_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

    ALTER TABLE teams ADD CONSTRAINT teams_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE match_players ADD CONSTRAINT match_players_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE match_results ADD CONSTRAINT match_results_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON UPDATE CASCADE ON DELETE CASCADE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Revert defaults to raw sequences
    ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE matches ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE deposit_requests ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE withdrawal_requests ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE wallet_ledger ALTER COLUMN id DROP DEFAULT;
  `);
};
