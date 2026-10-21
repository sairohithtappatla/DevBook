-- Rollback for 07_strict_reader_rule.sql: restores the reader rule of 02_reader_objects.sql verbatim (legacy fallbacks
-- included). Run before 02_rollback.sql. After this, edits to legacy steps that 02b did NOT freeze go live immediately again.
BEGIN;

CREATE OR REPLACE FUNCTION public.reader_markdown(step_content jsonb, book_status publication_status)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT CASE
        WHEN jsonb_typeof(step_content -> 'publishedMarkdown') = 'string'
            THEN step_content ->> 'publishedMarkdown'
        WHEN step_content ->> 'status' = 'Published'
            THEN CASE WHEN jsonb_typeof(step_content -> 'markdown') = 'string'
                      THEN step_content ->> 'markdown' ELSE '' END
        WHEN coalesce(step_content ->> 'status', '') = ''
             AND book_status = 'PUBLISHED'
             AND jsonb_typeof(step_content -> 'markdown') = 'string'
            THEN step_content ->> 'markdown'
        ELSE NULL
    END
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
