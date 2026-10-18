-- Rollback for 02_reader_objects.sql. Run 03_rollback.sql FIRST (the step 3 policies call these functions).
BEGIN;
DROP VIEW IF EXISTS public.reader_book_step_counts;
DROP VIEW IF EXISTS public.reader_steps;
DROP FUNCTION IF EXISTS public.reader_book_tree(uuid, boolean);
DROP FUNCTION IF EXISTS public.reader_step_json(public.steps, publication_status, boolean);
DROP FUNCTION IF EXISTS public.step_is_reader_visible(uuid, uuid);
DROP FUNCTION IF EXISTS public.reader_markdown(jsonb, publication_status);
NOTIFY pgrst, 'reload schema';
COMMIT;
