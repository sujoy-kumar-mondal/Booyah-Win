/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Ensure sequence exists for staff table
    CREATE SEQUENCE IF NOT EXISTS staff_id_seq START 1;

    -- 2. Drop all foreign key constraints referencing staff(id)
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'staff'
          AND ccu.column_name = 'id'
      ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
      END LOOP;
    END $$;

    -- 3. Alter child/referencing columns to TEXT (prefixing existing data)
    ALTER TABLE staff ALTER COLUMN created_by TYPE TEXT USING (
      CASE WHEN created_by IS NULL THEN NULL
           WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
           ELSE 'BW-STF-' || created_by::text
      END
    );

    ALTER TABLE users ALTER COLUMN deleted_by TYPE TEXT USING (
      CASE WHEN deleted_by IS NULL THEN NULL
           WHEN deleted_by::text LIKE 'BW-STF-%' THEN deleted_by::text
           ELSE 'BW-STF-' || deleted_by::text
      END
    );

    ALTER TABLE deposit_requests ALTER COLUMN reviewed_by TYPE TEXT USING (
      CASE WHEN reviewed_by IS NULL THEN NULL
           WHEN reviewed_by::text LIKE 'BW-STF-%' THEN reviewed_by::text
           ELSE 'BW-STF-' || reviewed_by::text
      END
    );

    ALTER TABLE deposit_requests ALTER COLUMN employee_reviewed_by TYPE TEXT USING (
      CASE WHEN employee_reviewed_by IS NULL THEN NULL
           WHEN employee_reviewed_by::text LIKE 'BW-STF-%' THEN employee_reviewed_by::text
           ELSE 'BW-STF-' || employee_reviewed_by::text
      END
    );

    ALTER TABLE withdrawal_requests ALTER COLUMN processed_by TYPE TEXT USING (
      CASE WHEN processed_by IS NULL THEN NULL
           WHEN processed_by::text LIKE 'BW-STF-%' THEN processed_by::text
           ELSE 'BW-STF-' || processed_by::text
      END
    );

    ALTER TABLE withdrawal_requests ALTER COLUMN employee_reviewed_by TYPE TEXT USING (
      CASE WHEN employee_reviewed_by IS NULL THEN NULL
           WHEN employee_reviewed_by::text LIKE 'BW-STF-%' THEN employee_reviewed_by::text
           ELSE 'BW-STF-' || employee_reviewed_by::text
      END
    );

    ALTER TABLE matches ALTER COLUMN created_by TYPE TEXT USING (
      CASE WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
           ELSE 'BW-STF-' || created_by::text
      END
    );

    ALTER TABLE match_results ALTER COLUMN submitted_by TYPE TEXT USING (
      CASE WHEN submitted_by::text LIKE 'BW-STF-%' THEN submitted_by::text
           ELSE 'BW-STF-' || submitted_by::text
      END
    );

    ALTER TABLE match_results ALTER COLUMN approved_by TYPE TEXT USING (
      CASE WHEN approved_by IS NULL THEN NULL
           WHEN approved_by::text LIKE 'BW-STF-%' THEN approved_by::text
           ELSE 'BW-STF-' || approved_by::text
      END
    );

    ALTER TABLE audit_logs ALTER COLUMN staff_id TYPE TEXT USING (
      CASE WHEN staff_id IS NULL THEN NULL
           WHEN staff_id::text LIKE 'BW-STF-%' THEN staff_id::text
           ELSE 'BW-STF-' || staff_id::text
      END
    );

    ALTER TABLE app_settings ALTER COLUMN updated_by TYPE TEXT USING (
      CASE WHEN updated_by IS NULL THEN NULL
           WHEN updated_by::text LIKE 'BW-STF-%' THEN updated_by::text
           ELSE 'BW-STF-' || updated_by::text
      END
    );

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'banners') THEN
        ALTER TABLE banners ALTER COLUMN created_by TYPE TEXT USING (
          CASE WHEN created_by IS NULL THEN NULL
               WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
               ELSE 'BW-STF-' || created_by::text
          END
        );
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'important_updates') THEN
        ALTER TABLE important_updates ALTER COLUMN created_by TYPE TEXT USING (
          CASE WHEN created_by IS NULL THEN NULL
               WHEN created_by::text LIKE 'BW-STF-%' THEN created_by::text
               ELSE 'BW-STF-' || created_by::text
          END
        );
      END IF;
    END $$;

    -- 4. Alter staff.id primary key column to TEXT
    ALTER TABLE staff ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE staff ALTER COLUMN id TYPE TEXT USING (
      CASE WHEN id::text LIKE 'BW-STF-%' THEN id::text
           ELSE 'BW-STF-' || id::text
      END
    );

    -- 5. Set column default using sequence
    ALTER TABLE staff ALTER COLUMN id SET DEFAULT ('BW-STF-' || nextval('staff_id_seq')::text);

    -- 6. Synchronize sequence with existing data
    DO $$
    DECLARE
      max_s bigint;
    BEGIN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^BW-STF-', ''), '')::bigint), 0) INTO max_s FROM staff;
      IF max_s > 0 THEN
        PERFORM setval('staff_id_seq', max_s, true);
      ELSE
        PERFORM setval('staff_id_seq', 1, false);
      END IF;
    END $$;

    -- 7. Update sessions and audit_logs
    UPDATE sessions
    SET account_id = 'BW-STF-' || account_id
    WHERE account_type = 'staff' AND account_id NOT LIKE 'BW-STF-%';

    UPDATE audit_logs
    SET target_id = 'BW-STF-' || target_id
    WHERE target_type IN ('employee', 'staff') AND target_id IS NOT NULL AND target_id NOT LIKE 'BW-STF-%';

    -- 8. Re-create foreign key constraints
    ALTER TABLE staff ADD CONSTRAINT staff_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE users ADD CONSTRAINT users_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_employee_reviewed_by_fkey FOREIGN KEY (employee_reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_employee_reviewed_by_fkey FOREIGN KEY (employee_reviewed_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE matches ADD CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE;
    ALTER TABLE match_results ADD CONSTRAINT match_results_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES staff(id) ON UPDATE CASCADE;
    ALTER TABLE match_results ADD CONSTRAINT match_results_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'banners') THEN
        ALTER TABLE banners ADD CONSTRAINT banners_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'important_updates') THEN
        ALTER TABLE important_updates ADD CONSTRAINT important_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Revert default on staff.id
    ALTER TABLE staff ALTER COLUMN id DROP DEFAULT;
  `);
};

