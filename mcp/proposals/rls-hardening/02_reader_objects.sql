-- Step 2 of 3: ADDITIVE reader objects. No existing policy or table is touched, so this can go live
-- before the new frontend. PROPOSAL. NOT APPLIED to any real backend. Depends on step 1.
--
-- Where draft Markdown can leave the database after step 3, and who may receive it:
--   * base table `steps`   -> OWNER / EDITOR / REVIEWER only (policy, step 3)
--   * reader_book_tree(.., include_drafts => true) -> the same people only (checked inside the function)
--   * everything else (views, tree with include_drafts false) -> published text only, for everyone
BEGIN;

-- The approved reader rule in ONE place (mirrors src/lib/reader-visibility.ts). NULL = hidden from readers.
--   1 publishedMarkdown is a string                          -> publishedMarkdown
--   2 status = 'Published'                                   -> markdown ('' if not a string)
--   3 status = 'Draft'                                       -> hidden, whatever the book status is
--   4 status missing, book PUBLISHED, markdown is a string   -> markdown (legacy)
--   5 anything else                                          -> hidden
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

-- Is this step visible in LISTS to this user (used by the attachments policy in step 3).
CREATE OR REPLACE FUNCTION public.step_is_reader_visible(target_step_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
          FROM steps s
          JOIN phases p ON p.id = s.phase_id
          JOIN books b ON b.id = p.book_id
         WHERE s.id = target_step_id
           AND public.reader_markdown(s.content, b.publication_status) IS NOT NULL
           AND public.can_discover_book(p.book_id, req_user_id)
    );
END;
$function$;

-- One step as JSON for the reader tree. NULL = hidden. with_drafts = true returns the current draft text.
CREATE OR REPLACE FUNCTION public.reader_step_json(s public.steps, book_status publication_status, with_drafts boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    pub text := public.reader_markdown(s.content, book_status);
BEGIN
    IF with_drafts THEN
        RETURN jsonb_build_object(
            'id', s.id, 'title', s.title, 'position', s.position,
            'slug', s.content -> 'slug', 'description', s.content -> 'description',
            'difficulty', s.content -> 'difficulty', 'estimatedTime', s.content -> 'estimatedTime',
            'visibility', s.content -> 'visibility',
            'status', coalesce(s.content ->> 'status', 'Draft'),
            'markdown', CASE WHEN jsonb_typeof(s.content -> 'markdown') = 'string'
                             THEN s.content ->> 'markdown' ELSE coalesce(pub, '') END,
            'publishedMarkdown', s.content -> 'publishedMarkdown'
        );
    END IF;

    IF pub IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'id', s.id, 'title', s.title, 'position', s.position,
        'slug', s.content -> 'slug', 'description', s.content -> 'description',
        'difficulty', s.content -> 'difficulty', 'estimatedTime', s.content -> 'estimatedTime',
        'visibility', s.content -> 'visibility',
        'status', 'Published', 'markdown', pub, 'publishedMarkdown', pub
    );
END;
$function$;

-- The DIRECT-LINK read path (D-c). Permission to read is can_read_book, NOT discoverability, so an
-- UNLISTED book opens for anyone who knows its id while staying out of every list. One call returns the
-- book, its visible phases/steps and their attachments. Drafts only if requested AND can_view_drafts.
CREATE OR REPLACE FUNCTION public.reader_book_tree(target_book_id uuid, include_drafts boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := auth.uid();
    bk RECORD;
    drafts boolean;
BEGIN
    IF NOT public.can_read_book(target_book_id, uid) THEN
        RETURN NULL;
    END IF;

    drafts := coalesce(include_drafts, false) AND public.can_view_drafts(target_book_id, uid);

    SELECT * INTO bk FROM books WHERE id = target_book_id;

    RETURN jsonb_build_object(
        'book', jsonb_build_object(
            'id', bk.id, 'title', bk.title, 'slug', bk.slug, 'description', bk.description,
            'cover_url', bk.cover_url, 'publication_status', bk.publication_status,
            'access_level', bk.access_level, 'estimated_read_time', bk.estimated_read_time,
            'difficulty', bk.difficulty, 'tags', bk.tags, 'created_by', bk.created_by,
            'created_at', bk.created_at, 'updated_at', bk.updated_at,
            'creator', (SELECT jsonb_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url, 'bio', u.bio)
                          FROM users u WHERE u.id = bk.created_by)
        ),
        'phases', coalesce((
            SELECT jsonb_agg(ph.j ORDER BY ph.pos)
              FROM (
                SELECT p.position AS pos,
                       jsonb_build_object('id', p.id, 'title', p.title, 'position', p.position, 'steps', st.steps) AS j
                  FROM phases p
                 CROSS JOIN LATERAL (
                        SELECT coalesce(jsonb_agg(x.j ORDER BY x.pos), '[]'::jsonb) AS steps
                          FROM (
                                SELECT public.reader_step_json(s, bk.publication_status, drafts)
                                       || jsonb_build_object('attachments', coalesce((
                                              SELECT jsonb_agg(jsonb_build_object(
                                                         'id', a.id, 'file_name', a.file_name,
                                                         'storage_path', a.storage_path,
                                                         'file_type', a.file_type, 'file_size', a.file_size))
                                                FROM attachments a WHERE a.step_id = s.id), '[]'::jsonb)) AS j,
                                       s.position AS pos
                                  FROM steps s
                                 WHERE s.phase_id = p.id
                                   AND public.reader_step_json(s, bk.publication_status, drafts) IS NOT NULL
                          ) x
                 ) st
                 WHERE p.book_id = bk.id
                   AND jsonb_array_length(st.steps) > 0
              ) ph
        ), '[]'::jsonb)
    );
END;
$function$;

-- Reader-facing LIST views: discoverable books only (never UNLISTED for non-members), reader-visible steps only,
-- no draft text, no search_vector. They run with the view owner's rights (the default), so they keep working
-- after step 3 restricts the base table. ASSUMPTION to verify on the test project: the owner bypasses RLS.
CREATE OR REPLACE VIEW public.reader_steps AS
SELECT s.id,
       s.phase_id,
       p.book_id,
       s.title,
       s.type,
       s.position,
       s.created_at,
       s.updated_at,
       jsonb_build_object(
           'slug',              s.content -> 'slug',
           'description',       s.content -> 'description',
           'difficulty',        s.content -> 'difficulty',
           'estimatedTime',     s.content -> 'estimatedTime',
           'visibility',        s.content -> 'visibility',
           'status',            'Published',
           'markdown',          public.reader_markdown(s.content, b.publication_status),
           'publishedMarkdown', public.reader_markdown(s.content, b.publication_status)
       ) AS content
  FROM public.steps s
  JOIN public.phases p ON p.id = s.phase_id
  JOIN public.books b ON b.id = p.book_id
 WHERE public.reader_markdown(s.content, b.publication_status) IS NOT NULL
   AND public.can_discover_book(p.book_id, (SELECT auth.uid()));

CREATE OR REPLACE VIEW public.reader_book_step_counts AS
SELECT book_id, count(*)::integer AS step_count
  FROM public.reader_steps
 GROUP BY book_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT SELECT ON public.reader_steps, public.reader_book_step_counts TO anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT ON public.reader_steps, public.reader_book_step_counts TO authenticated;
    END IF;
END
$$;

-- Explicit EXECUTE (see 01): the policies of step 3 and the API call these as anon / authenticated.
DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION public.reader_markdown(jsonb, publication_status), public.step_is_reader_visible(uuid, uuid), public.reader_step_json(public.steps, publication_status, boolean), public.reader_book_tree(uuid, boolean) TO %I', r);
        END IF;
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
