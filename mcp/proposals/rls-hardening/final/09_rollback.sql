-- Rollback for 09_secure_attachment_storage.sql (revision 2.1).
-- WARNING: this RE-OPENS finding F7/F27. With the four policies gone and RLS disabled, the table grants let ANY signed-in user
-- read, overwrite or delete ANY object in ANY private bucket if they know its key (the state before 09 on a fresh install).
-- Prefer one of these instead of a full rollback:
--   (a) to stop attachment access entirely: keep RLS enabled and only drop the four policies below (everything is then denied
--       to users; admin/API key still works);
--   (b) to restore the pre-09 state exactly, run this whole file - and only if the project had RLS DISABLED before 09
--       (check the preflight record: `select relrowsecurity from pg_class where oid = 'storage.objects'::regclass`).
-- If the project had InsForge's auto-installed owner-only policies before 09, re-create them instead of disabling RLS.
-- The grants to authenticated (SELECT, INSERT, UPDATE, DELETE) are InsForge's documented storage grants (not verified on TEST
-- before 09: no pre-09 snapshot exists) and are left in place. Revision 2.1
-- grants nothing to anon; the two REVOKEs below only clean up revision-1 attempts and are harmless if nothing was granted.

DROP POLICY IF EXISTS select_book_assets ON storage.objects;
DROP POLICY IF EXISTS insert_book_assets ON storage.objects;
DROP POLICY IF EXISTS update_book_assets ON storage.objects;
DROP POLICY IF EXISTS delete_book_assets ON storage.objects;

-- (b) only: comment out for option (a)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

REVOKE SELECT ON storage.objects FROM anon;
REVOKE USAGE ON SCHEMA storage FROM anon;

DROP FUNCTION IF EXISTS public.can_access_attachment_object(text, text, boolean);

NOTIFY pgrst, 'reload schema';
