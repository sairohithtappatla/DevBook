-- Step 8: phases that contain no reader-visible step are not readable by readers.
-- Finding S4 (confirmed on TEST 2026-10-20 through the real anonymous API): select_phases (03) allowed every caller who can
-- DISCOVER a book to read ALL of its phases, so titles of draft-only phases (e.g. "Phase D (draft only)") reached anonymous
-- readers, VIEWERs and other non-draft roles, although reader_book_tree and the MCP hide them.
-- New rule: a phase row is readable by
--   * draft viewers of the book (OWNER / EDITOR / REVIEWER; can_view_drafts), unchanged, or
--   * anyone who may discover the book, but only if the phase has at least one step whose published text readers may see
--     (reader_markdown IS NOT NULL) and the book is not soft-deleted: the same set of phases reader_book_tree returns.
-- Editors keep full access (also through modify_phases). The helper decides for the CALLER only (auth.uid(); no user-id
-- parameter, so it cannot be used to probe other users), pins its search_path and runs with its owner's rights because
-- `steps` is not readable by readers. Requires 01, 02 (and 07 for the strict reader rule). Rollback: 08_rollback.sql.

CREATE OR REPLACE FUNCTION public.phase_is_reader_visible(target_phase_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
          FROM public.phases p
          JOIN public.books b ON b.id = p.book_id
          JOIN public.steps s ON s.phase_id = p.id
         WHERE p.id = target_phase_id
           AND b.deleted_at IS NULL
           AND public.can_discover_book(p.book_id, auth.uid())
           AND public.reader_markdown(s.content, b.publication_status) IS NOT NULL
    );
END;
$function$;

-- Policies run with the caller's rights, so the browser roles need EXECUTE (explicit, like 01/02).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT EXECUTE ON FUNCTION public.phase_is_reader_visible(uuid) TO anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.phase_is_reader_visible(uuid) TO authenticated;
    END IF;
END
$$;

DROP POLICY IF EXISTS select_phases ON public.phases;
CREATE POLICY select_phases ON public.phases FOR SELECT TO public
    USING (public.can_view_drafts(book_id, (SELECT auth.uid())) OR public.phase_is_reader_visible(id));

NOTIFY pgrst, 'reload schema';
