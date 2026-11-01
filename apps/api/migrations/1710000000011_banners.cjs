/**
 * Migration: Create banners table for admin banner management
 */

/* eslint-disable no-undef */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS banners (
      id          BIGSERIAL PRIMARY KEY,
      title       TEXT,
      image_key   TEXT NOT NULL,
      target_url  TEXT NOT NULL,
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_by  BIGINT REFERENCES staff(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_banners_active_order ON banners (is_active, sort_order ASC, id ASC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_banners_active_order;
    DROP TABLE IF EXISTS banners;
  `);
};
