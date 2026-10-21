-- Step 2b: DATA FIX for legacy steps. Run after 02 and BEFORE 03 (and before MCP write tools are enabled). PROPOSAL.
-- NOT APPLIED to any real backend. Run on the TEST project first. Size it beforehand with preflight Q11 (counts only).
--
-- Problem (review 2026-10-20, finding S1): reader_markdown() serves the CURRENT `markdown` of a step that has no
-- publishedMarkdown string when its status is 'Published' (rule 2) or when it has no status and its book is PUBLISHED
-- (rule 4). Every later edit of `markdown` (browser autosave, MCP update_draft) therefore goes live immediately. The
-- browser autosave also turns a missing status into 'Draft', which hides such a step from readers after its first save.
-- Scope (narrowed 2026-10-20, finding F21): ONLY rule-4 steps (NO status, PUBLISHED book, markdown is a string). These are
-- genuine legacy/seeded rows whose current text IS their approved published text, so freezing it is safe.
-- Rule-2 steps (status 'Published' without publishedMarkdown) are NOT frozen here: the browser editor's autosave produces
-- exactly that shape by deleting publishedMarkdown (finding F21), so their current text may be an UNAPPROVED draft.
-- 07 hides them from readers; freezing them anyway is a separate, explicit owner decision (02c_optional_*.sql).
-- Fix: freeze what readers see TODAY for rule-4 steps: publishedMarkdown := current markdown, status := 'Published'.
-- What readers see does not change; only FUTURE edits of these steps become drafts.
--
-- Reversible: the original 'publishedMarkdown'/'status' keys are kept in a private backup table; 02b_rollback.sql restores
-- them only where publishedMarkdown still equals the frozen value (steps published since then are left alone and counted).
-- Side effects: the audit trigger sets updated_at = now() and updated_by = auth.uid() (NULL with the admin key) on the
-- frozen rows; search_vector is recomputed from the unchanged markdown; open editor tabs and MCP revisions of those
-- steps become stale (MCP answers CONFLICT and the caller re-reads). Running it twice fails (backup table exists).
BEGIN;

CREATE TABLE public._rls02b_step_freeze_backup (
    step_id         uuid        PRIMARY KEY REFERENCES public.steps (id) ON DELETE CASCADE,
    original_keys   jsonb       NOT NULL, -- the step's original publishedMarkdown/status keys; absent keys stay absent
    frozen_markdown text        NOT NULL, -- the value this file wrote to publishedMarkdown
    frozen_at       timestamptz NOT NULL DEFAULT now()
);
-- Private: RLS on with no policy, and no privileges for the API roles.
ALTER TABLE public._rls02b_step_freeze_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._rls02b_step_freeze_backup FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public._rls02b_step_freeze_backup FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public._rls02b_step_freeze_backup FROM authenticated;
    END IF;
END
$$;

INSERT INTO public._rls02b_step_freeze_backup (step_id, original_keys, frozen_markdown)
SELECT s.id,
       coalesce((SELECT jsonb_object_agg(e.key, e.value)
                   FROM jsonb_each(s.content) e
                  WHERE e.key IN ('publishedMarkdown', 'status')), '{}'::jsonb),
       public.reader_markdown(s.content, b.publication_status)
  FROM public.steps s
  JOIN public.phases p ON p.id = s.phase_id
  JOIN public.books b ON b.id = p.book_id
 WHERE jsonb_typeof(s.content -> 'publishedMarkdown') IS DISTINCT FROM 'string'
   AND coalesce(s.content ->> 'status', '') = ''
   AND b.publication_status = 'PUBLISHED'
   AND jsonb_typeof(s.content -> 'markdown') = 'string';

UPDATE public.steps s
   SET content = s.content || jsonb_build_object('publishedMarkdown', f.frozen_markdown, 'status', 'Published')
  FROM public._rls02b_step_freeze_backup f
 WHERE f.step_id = s.id;

DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n FROM public._rls02b_step_freeze_backup;
    RAISE NOTICE '02b: froze % legacy step(s)', n;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
