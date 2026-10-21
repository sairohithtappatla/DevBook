-- Rollback for 08_hide_draft_only_phases.sql: restores select_phases exactly as 03_policy_switch.sql defines it and drops the
-- helper. Afterwards titles of draft-only phases are readable again by everyone who can discover the book (finding S4).
BEGIN;
DROP POLICY IF EXISTS select_phases ON public.phases;
CREATE POLICY select_phases ON public.phases FOR SELECT TO public
    USING (public.can_discover_book(book_id, (SELECT auth.uid())));
DROP FUNCTION IF EXISTS public.phase_is_reader_visible(uuid);
NOTIFY pgrst, 'reload schema';
COMMIT;
