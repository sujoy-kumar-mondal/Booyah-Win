/**
 * Migration: Create notifications table for automated and admin notifications
 */

/* eslint-disable no-undef */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id            BIGSERIAL PRIMARY KEY,
      user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
      type          VARCHAR(50) NOT NULL,
      title         TEXT NOT NULL,
      message       TEXT NOT NULL,
      action_url    TEXT,
      metadata      JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS notifications;`);
};

