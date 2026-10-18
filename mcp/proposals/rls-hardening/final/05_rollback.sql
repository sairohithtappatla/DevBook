-- Rollback for 05_optional_reset_my_book_progress.sql. Independent of 01-04.
BEGIN;
DROP FUNCTION IF EXISTS public.reset_my_book_progress(uuid);
NOTIFY pgrst, 'reload schema';
COMMIT;
