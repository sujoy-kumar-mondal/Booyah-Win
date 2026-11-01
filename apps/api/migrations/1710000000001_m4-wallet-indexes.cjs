/* eslint-disable no-undef */
/**
 * Milestone 4 schema changes:
 *  1. Drop hard UNIQUE on deposit_requests.utr; replace with a partial unique index
 *     (WHERE status <> 'rejected') so a rejected UTR can be resubmitted.
 *  2. Add partial unique index on withdrawal_requests(user_id) WHERE status = 'pending'
 *     so DB enforces the one-pending-withdrawal rule (23505 -> WITHDRAWAL_PENDING).
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Remove the hard UNIQUE constraint on utr
    ALTER TABLE deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_utr_key;
    DROP INDEX IF EXISTS deposit_requests_utr_key;

    -- Partial unique index: UTR must be unique among non-rejected deposits
    CREATE UNIQUE INDEX IF NOT EXISTS deposit_requests_utr_active_unique
      ON deposit_requests (utr)
      WHERE status <> 'rejected';

    -- 2. One pending withdrawal per user (DB-enforced)
    CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_user_pending_unique
      ON withdrawal_requests (user_id)
      WHERE status = 'pending';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS withdrawal_requests_user_pending_unique;
    DROP INDEX IF EXISTS deposit_requests_utr_active_unique;
    ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_utr_key UNIQUE (utr);
  `);
};
