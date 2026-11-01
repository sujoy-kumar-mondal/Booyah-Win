/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
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
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS device_tokens CASCADE;
  `);
};

