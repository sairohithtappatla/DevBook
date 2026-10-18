-- Rollback for 03_policy_switch.sql: restores every touched policy and the function exactly as read from your
-- backend on 2026-10-18 (`db policies --json`, `db functions --json`).
BEGIN;

DROP POLICY IF EXISTS select_attachments ON public.attachments;
CREATE POLICY select_attachments ON public.attachments FOR SELECT TO public
    USING (can_read_book(get_book_id_for_step(step_id), ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_steps ON public.steps;
CREATE POLICY select_steps ON public.steps FOR SELECT TO public
    USING (can_read_book(get_book_id_for_phase(phase_id), ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_revisions ON public.book_revisions;
CREATE POLICY select_revisions ON public.book_revisions FOR SELECT TO public
    USING (can_read_book(book_id, ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_access ON public.book_access;
CREATE POLICY select_access ON public.book_access FOR SELECT TO public
    USING (can_read_book(book_id, ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_members ON public.book_members;
CREATE POLICY select_members ON public.book_members FOR SELECT TO public
    USING (can_read_book(book_id, ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_phases ON public.phases;
CREATE POLICY select_phases ON public.phases FOR SELECT TO public
    USING (can_read_book(book_id, ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS select_books ON public.books;
CREATE POLICY select_books ON public.books FOR SELECT TO public
    USING ((can_read_book(id, ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid))));

CREATE OR REPLACE FUNCTION public.get_book_id_for_step(target_step_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
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

COMMIT;
