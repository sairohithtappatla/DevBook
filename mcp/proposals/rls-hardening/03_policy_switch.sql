-- Step 3 of 3: THE BEHAVIOUR CHANGE. PROPOSAL. NOT APPLIED to any real backend.
-- DO NOT APPLY on production until the frontend that reads the reader objects (reader_book_tree,
-- reader_book_step_counts) is live there; before that, step counts, the reader and progress reset break
-- for non-editors. Depends on steps 1 and 2.
--
-- After this:
--   * list-capable tables use DISCOVERABILITY (UNLISTED books are not enumerable by non-members);
--   * `steps` is readable by OWNER/EDITOR/REVIEWER only (draft Markdown and search_vector included);
--   * everyone else reads steps through the reader objects (published text only).
BEGIN;

-- Same body as today, now SECURITY DEFINER. Without this, step_progress and attachments policies (which call
-- it) get NULL for readers once steps become invisible to them.
CREATE OR REPLACE FUNCTION public.get_book_id_for_step(target_step_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN (
        SELECT p.book_id
        FROM phases p
        JOIN steps s ON s.phase_id = p.id
        WHERE s.id = target_step_id
    );
END;
$function$;

DROP POLICY IF EXISTS select_books ON public.books;
CREATE POLICY select_books ON public.books FOR SELECT TO public
    USING (public.can_discover_book(id, (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS select_phases ON public.phases;
CREATE POLICY select_phases ON public.phases FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_members ON public.book_members;
CREATE POLICY select_members ON public.book_members FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_access ON public.book_access;
CREATE POLICY select_access ON public.book_access FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_revisions ON public.book_revisions;
CREATE POLICY select_revisions ON public.book_revisions FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_steps ON public.steps;
CREATE POLICY select_steps ON public.steps FOR SELECT TO public
    USING (public.can_view_drafts(public.get_book_id_for_phase(phase_id), (SELECT auth.uid())));

DROP POLICY IF EXISTS select_attachments ON public.attachments;
CREATE POLICY select_attachments ON public.attachments FOR SELECT TO public
    USING (
        public.can_view_drafts(public.get_book_id_for_step(step_id), (SELECT auth.uid()))
        OR public.step_is_reader_visible(step_id, (SELECT auth.uid()))
    );

COMMIT;
