-- Rollback for 02c_optional_freeze_published_without_text.sql: restores the original publishedMarkdown/status keys where
-- publishedMarkdown is still the frozen value; steps published since the freeze are left alone and counted.
BEGIN;
DO $$
DECLARE
    restored integer;
    total integer;
BEGIN
    UPDATE public.steps s
       SET content = (s.content - 'publishedMarkdown' - 'status') || f.original_keys
      FROM public._rls02c_step_freeze_backup f
     WHERE f.step_id = s.id
       AND jsonb_typeof(s.content -> 'publishedMarkdown') = 'string'
       AND s.content ->> 'publishedMarkdown' = f.frozen_markdown;
    GET DIAGNOSTICS restored = ROW_COUNT;
    SELECT count(*) INTO total FROM public._rls02c_step_freeze_backup;
    RAISE NOTICE '02c rollback: restored % step(s), left % step(s) published or changed since the freeze', restored, total - restored;
END
$$;
DROP TABLE public._rls02c_step_freeze_backup;
NOTIFY pgrst, 'reload schema';
COMMIT;
