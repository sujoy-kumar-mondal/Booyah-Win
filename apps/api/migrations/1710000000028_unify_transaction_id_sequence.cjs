/* eslint-disable no-undef */
/**
 * Migration 1710000000028:
 * Unify transaction ID sequence across deposit_requests, withdrawal_requests, and wallet_ledger.
 * Eliminates duplicate/colliding transaction IDs (e.g. BW-TRX-1 in deposits vs withdrawals vs ledger),
 * assigns pending deposit request to BW-TRX-170, and ensures all future deposits and withdrawals
 * draw monotonically from the shared wallet_ledger_id_seq without collisions.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Alter defaults on deposit_requests and withdrawal_requests to use wallet_ledger_id_seq
    ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);
    ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);
    ALTER TABLE wallet_ledger ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('wallet_ledger_id_seq')::text);

    -- 2. Resolve existing collisions in booyah_dev (and any matching database)
    -- Update deposit_requests IDs from highest down to prevent any duplicate key errors:
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-7') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-170' WHERE id = 'BW-TRX-7';
      END IF;
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-6') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-161' WHERE id = 'BW-TRX-6';
      END IF;
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-5') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-107' WHERE id = 'BW-TRX-5';
      END IF;
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-4') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-72' WHERE id = 'BW-TRX-4';
      END IF;
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-3') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-5' WHERE id = 'BW-TRX-3';
      END IF;
      IF EXISTS (SELECT 1 FROM deposit_requests WHERE id = 'BW-TRX-2') THEN
        UPDATE deposit_requests SET id = 'BW-TRX-4' WHERE id = 'BW-TRX-2';
      END IF;
    END $$;

    -- 3. Update withdrawal_requests IDs:
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE id = 'BW-TRX-3') THEN
        UPDATE withdrawal_requests SET id = 'BW-TRX-116' WHERE id = 'BW-TRX-3';
      END IF;
      IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE id = 'BW-TRX-2') THEN
        UPDATE withdrawal_requests SET id = 'BW-TRX-57' WHERE id = 'BW-TRX-2';
      END IF;
      IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE id = 'BW-TRX-1') THEN
        UPDATE withdrawal_requests SET id = 'BW-TRX-23' WHERE id = 'BW-TRX-1';
      END IF;
    END $$;

    -- 4. Update wallet_ledger ref_id values atomically to match the new deposit/withdrawal IDs
    UPDATE wallet_ledger
    SET ref_id = CASE
      WHEN ref_type = 'deposit' AND (ref_id = 'BW-TRX-2' OR ref_id = '2') THEN 'BW-TRX-4'
      WHEN ref_type = 'deposit' AND (ref_id = 'BW-TRX-4' OR ref_id = '4') THEN 'BW-TRX-72'
      WHEN ref_type = 'deposit' AND (ref_id = 'BW-TRX-5' OR ref_id = '5') THEN 'BW-TRX-107'
      WHEN ref_type = 'deposit' AND (ref_id = 'BW-TRX-6' OR ref_id = '6') THEN 'BW-TRX-161'
      WHEN ref_type = 'withdrawal' AND (ref_id = 'BW-TRX-1' OR ref_id = '1') THEN 'BW-TRX-23'
      WHEN ref_type = 'withdrawal' AND (ref_id = 'BW-TRX-2' OR ref_id = '2') THEN 'BW-TRX-57'
      WHEN ref_type = 'withdrawal' AND (ref_id = 'BW-TRX-3' OR ref_id = '3') THEN 'BW-TRX-116'
      ELSE ref_id
    END
    WHERE (ref_type = 'deposit' AND ref_id IN ('BW-TRX-2', '2', 'BW-TRX-4', '4', 'BW-TRX-5', '5', 'BW-TRX-6', '6'))
       OR (ref_type = 'withdrawal' AND ref_id IN ('BW-TRX-1', '1', 'BW-TRX-2', '2', 'BW-TRX-3', '3'));

    -- 5. Update audit_logs target_id
    UPDATE audit_logs SET target_id = 'BW-TRX-1' WHERE target_type = 'deposit_requests' AND target_id = '1';
    UPDATE audit_logs SET target_id = 'BW-TRX-4' WHERE target_type = 'deposit_requests' AND target_id = '2';
    UPDATE audit_logs SET target_id = 'BW-TRX-5' WHERE target_type = 'deposit_requests' AND target_id = '3';
    UPDATE audit_logs SET target_id = 'BW-TRX-72' WHERE target_type = 'deposit_requests' AND target_id = '4';
    UPDATE audit_logs SET target_id = 'BW-TRX-107' WHERE target_type = 'deposit_requests' AND target_id = '5';
    UPDATE audit_logs SET target_id = 'BW-TRX-161' WHERE target_type = 'deposit_requests' AND target_id = '6';

    UPDATE audit_logs SET target_id = 'BW-TRX-23' WHERE target_type = 'withdrawal_requests' AND target_id = '1';
    UPDATE audit_logs SET target_id = 'BW-TRX-57' WHERE target_type = 'withdrawal_requests' AND target_id = '2';
    UPDATE audit_logs SET target_id = 'BW-TRX-116' WHERE target_type = 'withdrawal_requests' AND target_id = '3';

    -- 6. Update notifications action_url and metadata
    UPDATE notifications
    SET action_url = '/wallet/transactions/BW-TRX-161',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{depositId}', '"BW-TRX-161"')
    WHERE action_url LIKE '%DEP-6%' OR (metadata->>'depositId' = '6');

    UPDATE notifications
    SET action_url = '/wallet/transactions/BW-TRX-170',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{depositId}', '"BW-TRX-170"')
    WHERE action_url LIKE '%DEP-7%' OR (metadata->>'depositId' = '7');

    UPDATE notifications
    SET action_url = regexp_replace(action_url, '/wallet/transactions/(?:DEP-|WTH-)?', '/wallet/transactions/BW-TRX-')
    WHERE action_url LIKE '%/wallet/transactions/%' AND action_url NOT LIKE '%/wallet/transactions/BW-TRX-%';

    -- 7. Synchronize wallet_ledger_id_seq to the maximum transaction ID in the system
    DO $$
    DECLARE
      max_l bigint := 0;
      max_d bigint := 0;
      max_w bigint := 0;
      max_all bigint := 0;
    BEGIN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_l FROM wallet_ledger;
      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_d FROM deposit_requests;
      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-TRX-', ''), '')::bigint), 0) INTO max_w FROM withdrawal_requests;
      max_all := GREATEST(max_l, max_d, max_w);
      IF max_all > 0 THEN
        PERFORM setval('wallet_ledger_id_seq', max_all, true);
      ELSE
        PERFORM setval('wallet_ledger_id_seq', 1, false);
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE deposit_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('deposit_requests_id_seq')::text);
    ALTER TABLE withdrawal_requests ALTER COLUMN id SET DEFAULT ('BW-TRX-' || nextval('withdrawal_requests_id_seq')::text);
  `);
};
