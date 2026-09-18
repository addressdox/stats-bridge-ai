-- StatBridge migration, step 2a: make every foreign key in `public` deferrable.
-- The data contains circular references (a publication points at its current
-- version and the version points back at the publication), so the rows can only
-- be loaded when the checks run at the end of the transaction.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE', r.tbl, r.conname);
  END LOOP;
END $$;
