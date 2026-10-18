-- Step 5 (OPTIONAL, independent of 01-04): exact "reset my progress for this book".
-- PROPOSAL. NOT APPLIED to any real backend. The reader patch does NOT call it; until it exists the client clears the
-- progress rows of the steps it can see (the tree ids). What it fixes: rows of steps that were unpublished/never visible
-- and rows of books the user can no longer read, which RLS makes invisible and undeletable for the user.
-- Safety: no user-id parameter (auth.uid() only), deletes only the caller's own rows, pinned search_path, EXECUTE only
-- for authenticated (anon is refused). It does not check that the caller may still read the book on purpose: people may
-- always erase their own progress.
BEGIN;

CREATE OR REPLACE FUNCTION public.reset_my_book_progress(target_book_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := auth.uid();
    n integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
    END IF;

    DELETE FROM step_progress sp
          USING steps s, phases p
     WHERE sp.user_id = uid
       AND sp.step_id = s.id
       AND s.phase_id = p.id
       AND p.book_id = target_book_id;
    GET DIAGNOSTICS n = ROW_COUNT;

    DELETE FROM book_progress WHERE user_id = uid AND book_id = target_book_id;
    RETURN n;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reset_my_book_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_book_progress(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
