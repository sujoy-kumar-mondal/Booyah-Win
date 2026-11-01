/* eslint-disable no-undef */
/**
 * Migration 1710000000018:
 * 1. Adds 'all' to wallet_kind enum so combined wallet debits/credits can be represented in a single transaction.
 * 2. Consolidates any legacy split join_fee / refund rows into a single ledger transaction.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE wallet_kind ADD VALUE IF NOT EXISTS 'all';

    DO $$
    DECLARE
      rec RECORD;
      last_id BIGINT;
      total_amt NUMERIC(12,2);
    BEGIN
      FOR rec IN (
        SELECT user_id, ref_type, ref_id, type
        FROM wallet_ledger
        WHERE type IN ('join_fee', 'refund') AND ref_id IS NOT NULL
        GROUP BY user_id, ref_type, ref_id, type
        HAVING count(*) > 1
      ) LOOP
        SELECT id INTO last_id
        FROM wallet_ledger
        WHERE user_id = rec.user_id AND ref_type = rec.ref_type AND ref_id = rec.ref_id AND type = rec.type
        ORDER BY id DESC
        LIMIT 1;

        SELECT SUM(amount) INTO total_amt
        FROM wallet_ledger
        WHERE user_id = rec.user_id AND ref_type = rec.ref_type AND ref_id = rec.ref_id AND type = rec.type;

        UPDATE wallet_ledger
        SET amount = total_amt, wallet = 'all'
        WHERE id = last_id;

        DELETE FROM wallet_ledger
        WHERE user_id = rec.user_id AND ref_type = rec.ref_type AND ref_id = rec.ref_id AND type = rec.type AND id != last_id;
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Enum values cannot be removed in PostgreSQL.
};

