-- Step 7: STRICT reader rule. Run after 02b (and before or together with 03). PROPOSAL. NOT APPLIED to any real backend.
-- Defense in depth for finding S1: readers get ONLY an explicit publishedMarkdown string. The two legacy fallbacks of 02
-- (status 'Published' without publishedMarkdown -> current markdown; no status in a PUBLISHED book -> current markdown) are
-- removed, so unpublished text can never become reader-visible through fallback logic, whatever writes it (browser
-- autosave, MCP, API).
-- Precondition, checked below with the legacy rule written out (so it also holds on a re-run): no status-less legacy step of
-- a PUBLISHED book may still be unfrozen (02b freezes exactly those; otherwise genuine published content would vanish).
-- If the check fails the file aborts and changes nothing.
-- Intended effect: steps with status 'Published' but WITHOUT publishedMarkdown stop being served to readers. Their current
-- text may be an unapproved draft (the browser editor's autosave deleted publishedMarkdown, finding F21), so hiding them is
-- the safe default; the owner republishes them, or freezes them deliberately with 02c_optional_*.sql BEFORE this file.
-- Their number is reported as a NOTICE so it can be compared with preflight Q11.
-- Signature, volatility and ACL stay the same (CREATE OR REPLACE keeps grants); every caller (reader_book_tree,
-- reader_step_json, the reader views, step_is_reader_visible) picks up the stricter rule automatically.
BEGIN;

DO $$
DECLARE
    n integer;
    hidden integer;
BEGIN
    -- rule 4 of 02, written out on purpose: reader_markdown itself may already be strict (re-run)
    SELECT count(*) INTO n
      FROM public.steps s
      JOIN public.phases p ON p.id = s.phase_id
      JOIN public.books b ON b.id = p.book_id
     WHERE jsonb_typeof(s.content -> 'publishedMarkdown') IS DISTINCT FROM 'string'
       AND coalesce(s.content ->> 'status', '') = '' AND b.publication_status = 'PUBLISHED'
       AND jsonb_typeof(s.content -> 'markdown') = 'string';
    IF n > 0 THEN
        RAISE EXCEPTION '07 refused: % status-less legacy step(s) of PUBLISHED books are not frozen; apply 02b_legacy_step_freeze.sql first', n;
    END IF;
    -- rule 2 of 02: these stop being served to readers
    SELECT count(*) INTO hidden
      FROM public.steps s
     WHERE jsonb_typeof(s.content -> 'publishedMarkdown') IS DISTINCT FROM 'string'
       AND s.content ->> 'status' = 'Published';
    RAISE NOTICE '07: % step(s) marked Published without published text are no longer served to readers', hidden;
END
$$;

CREATE OR REPLACE FUNCTION public.reader_markdown(step_content jsonb, book_status publication_status)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    -- book_status is kept in the signature for compatibility with every caller; the strict rule does not need it.
    SELECT CASE WHEN jsonb_typeof(step_content -> 'publishedMarkdown') = 'string'
                THEN step_content ->> 'publishedMarkdown'
                ELSE NULL END
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
