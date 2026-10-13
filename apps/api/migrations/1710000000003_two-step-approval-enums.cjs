/* eslint-disable no-undef */
/**
 * Migration 1 of 2 for two-step approvals:
 * Adds 'employee_approved' value to request_status and withdraw_status enums.
 * Kept in its own migration file so the enum values commit before being used in columns/indexes.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'employee_approved';
    ALTER TYPE withdraw_status ADD VALUE IF NOT EXISTS 'employee_approved';
  `);
};

exports.down = (pgm) => {
  // PostgreSQL does not support removing enum values with ALTER TYPE ... DROP VALUE.
  // The enum values will remain in request_status and withdraw_status.
};
