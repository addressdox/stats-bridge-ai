-- StatBridge migration, step 3: point the existing staff profile at the new sign-in account.
--
-- Sign-in accounts live in Supabase's own auth store and cannot be exported, so
-- after the data load you create the staff account again in the new project and
-- run this file to attach the imported profile (and everything it owns) to it.
--
-- Usage:
--   psql "$TARGET_DB_URL" \
--     -v old_id="'<profile id from the old project>'" \
--     -v new_id="'<user id of the account you just created>'" \
--     -f migrate/03_relink_admin.sql

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

DO $$
DECLARE
  v_old uuid := :old_id;
  v_new uuid := :new_id;
  r record;
BEGIN
  UPDATE public.profiles SET id = v_new WHERE id = v_old;

  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN unnest(c.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
      USING v_new, v_old;
  END LOOP;

  UPDATE public.user_roles SET user_id = v_new WHERE user_id = v_old;
  UPDATE public.audit_events SET actor_id = v_new WHERE actor_id = v_old;
END $$;

COMMIT;
