-- Rollback for 06_pin_trigger_search_path.sql: back to the unpinned function configuration of the live export.
BEGIN;
ALTER FUNCTION public.trigger_add_book_owner() RESET search_path;
COMMIT;
