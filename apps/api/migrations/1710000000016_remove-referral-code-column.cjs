/**
 * Migration: Remove referral_code column from users table.
 * The player's unique username is used as their referral code throughout the system.
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- Drop referral_code column from users table
    ALTER TABLE users DROP COLUMN IF EXISTS referral_code;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Restore referral_code column matching username
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
    UPDATE users SET referral_code = username WHERE referral_code IS NULL;
    ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
      END IF;
    END $$;
  `);
};

