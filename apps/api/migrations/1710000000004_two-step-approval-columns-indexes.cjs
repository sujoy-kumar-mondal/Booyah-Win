/* eslint-disable no-undef */
/**
 * Migration 2 of 2 for two-step approvals:
 * 1. Add employee review columns on deposit_requests and withdrawal_requests.
 * 2. Update partial unique index on withdrawal_requests to enforce one pending OR
 *    employee_approved request per user.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Add employee review audit columns
    ALTER TABLE deposit_requests
      ADD COLUMN IF NOT EXISTS employee_reviewed_by BIGINT REFERENCES staff(id),
      ADD COLUMN IF NOT EXISTS employee_reviewed_at TIMESTAMPTZ;

    ALTER TABLE withdrawal_requests
      ADD COLUMN IF NOT EXISTS employee_reviewed_by BIGINT REFERENCES staff(id),
      ADD COLUMN IF NOT EXISTS employee_reviewed_at TIMESTAMPTZ;

    -- 2. Update withdrawal partial unique index to cover both pending and employee_approved
    DROP INDEX IF EXISTS withdrawal_requests_user_pending_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_user_pending_unique
      ON withdrawal_requests (user_id)
      WHERE status IN ('pending', 'employee_approved');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS withdrawal_requests_user_pending_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_user_pending_unique
      ON withdrawal_requests (user_id)
      WHERE status = 'pending';

    ALTER TABLE withdrawal_requests
      DROP COLUMN IF EXISTS employee_reviewed_at,
      DROP COLUMN IF EXISTS employee_reviewed_by;

    ALTER TABLE deposit_requests
      DROP COLUMN IF EXISTS employee_reviewed_at,
      DROP COLUMN IF EXISTS employee_reviewed_by;
  `);
};
