/* eslint-disable no-undef */
/**
 * Migration 1710000000027:
 * Replaces deposit ID and withdrawal ID with transaction ID (BW-TRX-<id>)
 * across deposit_requests, withdrawal_requests, wallet_ledger, audit_logs, and notifications.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Alter sequence defaults for deposit_requests and withdrawal_requests to use BW-TRX- prefix
    ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('deposit_requests_id_seq')::text);
    ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('withdrawal_requests_id_seq')::text);

    -- 2. Update existing IDs in deposit_requests from BW-DPT- to BW-TRX-
    UPDATE deposit_requests
    SET id = regexp_replace(id, '^BW-DPT-', 'BW-TRX-')
    WHERE id LIKE 'BW-DPT-%';

    -- 3. Update existing IDs in withdrawal_requests from BW-WDL- to BW-TRX-
    UPDATE withdrawal_requests
    SET id = regexp_replace(id, '^BW-WDL-', 'BW-TRX-')
    WHERE id LIKE 'BW-WDL-%';

    -- 4. Update wallet_ledger ref_id referencing deposits or withdrawals
    UPDATE wallet_ledger
    SET ref_id = regexp_replace(ref_id, '^BW-DPT-', 'BW-TRX-')
    WHERE ref_id LIKE 'BW-DPT-%';

    UPDATE wallet_ledger
    SET ref_id = regexp_replace(ref_id, '^BW-WDL-', 'BW-TRX-')
    WHERE ref_id LIKE 'BW-WDL-%';

    -- 5. Update audit_logs target_id
    UPDATE audit_logs
    SET target_id = regexp_replace(target_id, '^BW-DPT-', 'BW-TRX-')
    WHERE target_id LIKE 'BW-DPT-%';

    UPDATE audit_logs
    SET target_id = regexp_replace(target_id, '^BW-WDL-', 'BW-TRX-')
    WHERE target_id LIKE 'BW-WDL-%';

    -- 6. Update notifications action_url
    UPDATE notifications
    SET action_url = regexp_replace(action_url, '/wallet/transactions/(?:DEP-|WTH-)?BW-(?:DPT|WDL)-', '/wallet/transactions/BW-TRX-')
    WHERE action_url LIKE '%/wallet/transactions/%';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-DPT-' || nextval('deposit_requests_id_seq')::text);
    ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-WDL-' || nextval('withdrawal_requests_id_seq')::text);

    UPDATE deposit_requests
    SET id = regexp_replace(id, '^BW-TRX-', 'BW-DPT-')
    WHERE id LIKE 'BW-TRX-%';

    UPDATE withdrawal_requests
    SET id = regexp_replace(id, '^BW-TRX-', 'BW-WDL-')
    WHERE id LIKE 'BW-TRX-%';

    UPDATE wallet_ledger
    SET ref_id = regexp_replace(ref_id, '^BW-TRX-', 'BW-DPT-')
    WHERE ref_type = 'deposit' AND ref_id LIKE 'BW-TRX-%';

    UPDATE wallet_ledger
    SET ref_id = regexp_replace(ref_id, '^BW-TRX-', 'BW-WDL-')
    WHERE ref_type = 'withdrawal' AND ref_id LIKE 'BW-TRX-%';

    UPDATE audit_logs
    SET target_id = regexp_replace(target_id, '^BW-TRX-', 'BW-DPT-')
    WHERE target_type = 'deposit_requests' AND target_id LIKE 'BW-TRX-%';

    UPDATE audit_logs
    SET target_id = regexp_replace(target_id, '^BW-TRX-', 'BW-WDL-')
    WHERE target_type = 'withdrawal_requests' AND target_id LIKE 'BW-TRX-%';
  `);
};

