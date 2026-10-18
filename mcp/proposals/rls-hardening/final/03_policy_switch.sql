-- FINAL candidate. Differences from the first draft: get_book_id_for_step checks can_read_book (F2); the member, access
-- and revision lists are limited to OWNER/EDITOR/REVIEWER (F1, decision to confirm: the app reads book_members only in the
-- editor's collaborator panel; nothing in the app reads book_access or book_revisions).
-- Step 3 of 3: THE BEHAVIOUR CHANGE. PROPOSAL. NOT APPLIED to any real backend.
-- DO NOT APPLY on production until the frontend that reads the reader objects (reader_book_tree,
-- reader_book_step_counts) is live there; before that, step counts, the reader and progress reset break
-- for non-editors. Depends on steps 1 and 2.
--
-- After this:
--   * a user can only insert books that are created_by themselves (F3);
--   * books and phases use DISCOVERABILITY (UNLISTED books are not enumerable by non-members); member, access and revision
--     lists are visible to OWNER/EDITOR/REVIEWER only;
--   * `steps` is readable by OWNER/EDITOR/REVIEWER only (draft Markdown and search_vector included);
--   * everyone else reads steps through the reader objects (published text only).
BEGIN;

-- SECURITY DEFINER because `steps` is no longer readable by ordinary readers. The old (invoker) version only returned
-- an id for steps the caller could see, so the definer version keeps that promise explicitly: it returns the book id
-- only when the caller may read the book. Without this check any caller who knows a step id would learn the id of its
-- book, which for an UNLISTED book is the link itself. Policies compare the result with can_read_book / can_view_drafts
-- for the same caller, so their outcome is unchanged.
CREATE OR REPLACE FUNCTION public.get_book_id_for_step(target_step_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    found_book uuid;
BEGIN
    SELECT p.book_id INTO found_book
      FROM phases p
      JOIN steps s ON s.phase_id = p.id
     WHERE s.id = target_step_id;

    IF found_book IS NULL OR NOT public.can_read_book(found_book, auth.uid()) THEN
        RETURN NULL;
    END IF;
    RETURN found_book;
END;
$function$;

-- F3 (pre-existing hole, found while reviewing the MCP): the original INSERT policy only required a login, and `created_by` is
-- client-supplied while trigger_add_book_owner (SECURITY DEFINER) makes NEW.created_by the OWNER. Any logged-in user could
-- therefore plant a book, with chosen title/description/cover, into another user's "My Books" and make that user its OWNER.
-- The check runs after the BEFORE trigger, which fills created_by with auth.uid() when the client sends none, so the app's
-- normal insert (no created_by) still passes.
DROP POLICY IF EXISTS insert_books ON public.books;
CREATE POLICY insert_books ON public.books FOR INSERT TO public
    WITH CHECK (((SELECT auth.uid()) IS NOT NULL) AND (created_by IS NULL OR created_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS select_books ON public.books;
CREATE POLICY select_books ON public.books FOR SELECT TO public
    USING (public.can_discover_book(id, (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())));

DROP POLICY IF EXISTS select_phases ON public.phases;
CREATE POLICY select_phases ON public.phases FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_members ON public.book_members;
CREATE POLICY select_members ON public.book_members FOR SELECT TO public
    USING (public.can_view_drafts(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_access ON public.book_access;
CREATE POLICY select_access ON public.book_access FOR SELECT TO public
    USING (public.can_view_drafts(book_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS select_revisions ON public.book_revisions;
CREATE POLICY select_revisions ON public.book_revisions FOR SELECT TO public
    USING (public.can_view_drafts(book_id, (SELECT auth.uid())));

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
