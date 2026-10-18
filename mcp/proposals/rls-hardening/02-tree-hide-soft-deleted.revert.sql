-- Revert for 02-tree-hide-soft-deleted.patch (PROPOSAL, NOT APPLIED). Only needed if the patched reader_book_tree was
-- already created on a backend: it restores the body of 02_reader_objects.sql as it is in the repo today.
-- CREATE OR REPLACE keeps the owner and the ACL (grants from 02 are unaffected). 02_rollback.sql drops the function
-- whichever body it has, so the normal rollback order is unchanged.
BEGIN;

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

COMMIT;
