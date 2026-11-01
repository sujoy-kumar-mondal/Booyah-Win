/* eslint-disable no-undef */
/**
 * Migration 1710000000008: Add last_otp_at and elevated_until to sessions table,
 * and allow 'step_up' in otp_requests.purpose.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS last_otp_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS elevated_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour');

    ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS otp_requests_purpose_check;
    ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_purpose_check CHECK (purpose IN ('register', 'login', 'step_up'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE sessions
      DROP COLUMN IF EXISTS last_otp_at,
      DROP COLUMN IF EXISTS elevated_until;

    ALTER TABLE otp_requests DROP CONSTRAINT IF EXISTS otp_requests_purpose_check;
    ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_purpose_check CHECK (purpose IN ('register', 'login'));
  `);
};
