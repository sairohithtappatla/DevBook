-- Rollback for 02b_legacy_step_freeze.sql. Independent of the 03/04 rollbacks (it only touches step content).
-- Restores the original publishedMarkdown/status keys of every frozen step whose publishedMarkdown still equals the frozen
-- value. Steps published (or otherwise changed in publishedMarkdown) after the freeze are left as they are and counted.
-- WARNING: after this, edits to the restored legacy steps go live immediately again (the pre-02b behaviour).
BEGIN;

DO $$
DECLARE
    restored integer;
    total integer;
BEGIN
    UPDATE public.steps s
       SET content = (s.content - 'publishedMarkdown' - 'status') || f.original_keys
      FROM public._rls02b_step_freeze_backup f
     WHERE f.step_id = s.id
       AND jsonb_typeof(s.content -> 'publishedMarkdown') = 'string'
       AND s.content ->> 'publishedMarkdown' = f.frozen_markdown;
    GET DIAGNOSTICS restored = ROW_COUNT;
    SELECT count(*) INTO total FROM public._rls02b_step_freeze_backup;
    RAISE NOTICE '02b rollback: restored % step(s), left % step(s) published or changed since the freeze', restored, total - restored;
END
$$;

DROP TABLE public._rls02b_step_freeze_backup;

NOTIFY pgrst, 'reload schema';
COMMIT;
