-- Step 2c (OPTIONAL, owner decision per step list): freeze steps marked 'Published' that have NO publishedMarkdown. PROPOSAL.
-- NOT APPLIED to any real backend. Run only after reviewing preflight Q12 (ids, titles, timestamps of these steps).
-- Why optional: the browser editor's autosave deleted publishedMarkdown while keeping status 'Published' (finding F21), so the
-- CURRENT markdown of such a step may be an unapproved draft. Under the legacy reader rule (02) readers already see it; under
-- the strict rule (07) it is hidden. Apply this file ONLY if the owner decides that the current text of these steps may be
-- published as is. Otherwise skip it: 07 hides them and the owner republishes them in the editor (after the editor fix).
-- Must run BEFORE 07 to keep them visible. Reversible with 02c_rollback.sql (same mechanism as 02b).
BEGIN;

CREATE TABLE public._rls02c_step_freeze_backup (
    step_id         uuid        PRIMARY KEY REFERENCES public.steps (id) ON DELETE CASCADE,
    original_keys   jsonb       NOT NULL,
    frozen_markdown text        NOT NULL,
    frozen_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._rls02c_step_freeze_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._rls02c_step_freeze_backup FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public._rls02c_step_freeze_backup FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public._rls02c_step_freeze_backup FROM authenticated;
    END IF;
END
$$;

INSERT INTO public._rls02c_step_freeze_backup (step_id, original_keys, frozen_markdown)
SELECT s.id,
       coalesce((SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(s.content) e
                  WHERE e.key IN ('publishedMarkdown', 'status')), '{}'::jsonb),
       CASE WHEN jsonb_typeof(s.content -> 'markdown') = 'string' THEN s.content ->> 'markdown' ELSE '' END
  FROM public.steps s
 WHERE jsonb_typeof(s.content -> 'publishedMarkdown') IS DISTINCT FROM 'string'
   AND s.content ->> 'status' = 'Published';

UPDATE public.steps s
   SET content = s.content || jsonb_build_object('publishedMarkdown', f.frozen_markdown)
  FROM public._rls02c_step_freeze_backup f
 WHERE f.step_id = s.id;

DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n FROM public._rls02c_step_freeze_backup;
    RAISE NOTICE '02c: froze % step(s) marked Published without published text', n;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
