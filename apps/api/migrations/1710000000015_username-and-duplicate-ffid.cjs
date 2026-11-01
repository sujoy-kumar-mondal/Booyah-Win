/**
 * Migration: Add username to users table, make referral_code match username,
 * and allow duplicate Free Fire IDs (remove UNIQUE on ff_id).
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Add username column with temporary fallback default
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username CITEXT DEFAULT ('user_' || substr(md5(random()::text), 1, 8));

    -- 2. Backfill existing users using their referral code (lowercased)
    UPDATE users SET username = LOWER(referral_code) WHERE referral_code IS NOT NULL;

    -- 3. Set NOT NULL and add UNIQUE constraint
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
      END IF;
    END $$;

    -- 4. Drop unique constraint on ff_id
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ff_id_key;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
    ALTER TABLE users DROP COLUMN IF EXISTS username;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_ff_id_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_ff_id_key UNIQUE (ff_id);
      END IF;
    END $$;
  `);
};

