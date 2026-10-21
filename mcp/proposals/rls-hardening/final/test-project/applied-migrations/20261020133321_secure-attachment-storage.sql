-- Step 9: Enforce RLS on storage.objects for book-assets bucket.
-- Prevents authenticated cross-user / cross-book access to attachments.
-- Solves Finding F7 / F27: storage service previously allowed any authenticated user to download any object
-- if they knew or guessed the key, bypassing book membership and publication status.
-- With this policy, storage downloads and uploads evaluate public.can_access_attachment_object():
--   * Upload / Delete: caller must have can_edit_book() for the step's book.
--   * Download: caller must have can_view_drafts() (owner/editor/reviewer) OR
--               (can_discover_book() AND the step is published via reader_markdown IS NOT NULL).
-- Draft-only steps, restricted books (draft, unlisted, deleted), and cross-book guessing are rejected (403/404).
-- Rollback: 09_rollback.sql

CREATE OR REPLACE FUNCTION public.can_access_attachment_object(target_bucket text, target_key text, check_write boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    target_step_id uuid;
    target_book_id uuid;
    step_content jsonb;
    book_pub_status public.publication_status;
BEGIN
    IF target_bucket <> 'book-assets' THEN
        RETURN true;
    END IF;

    IF NOT (split_part(target_key, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RETURN false;
    END IF;

    target_step_id := split_part(target_key, '/', 1)::uuid;

    SELECT p.book_id, s.content, b.publication_status
      INTO target_book_id, step_content, book_pub_status
      FROM public.steps s
      JOIN public.phases p ON p.id = s.phase_id
      JOIN public.books b ON b.id = p.book_id
     WHERE s.id = target_step_id
       AND b.deleted_at IS NULL;

    IF target_book_id IS NULL THEN
        RETURN false;
    END IF;

    IF check_write THEN
        RETURN public.can_edit_book(target_book_id, auth.uid());
    END IF;

    IF public.can_view_drafts(target_book_id, auth.uid()) THEN
        RETURN true;
    END IF;

    IF public.can_discover_book(target_book_id, auth.uid())
       AND public.reader_markdown(step_content, book_pub_status) IS NOT NULL THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_access_attachment_object(text, text, boolean) TO anon, authenticated;

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_book_assets ON storage.objects;
CREATE POLICY select_book_assets ON storage.objects FOR SELECT TO public
    USING (public.can_access_attachment_object(bucket, key, false));

DROP POLICY IF EXISTS insert_book_assets ON storage.objects;
CREATE POLICY insert_book_assets ON storage.objects FOR INSERT TO public
    WITH CHECK (public.can_access_attachment_object(bucket, key, true));

DROP POLICY IF EXISTS update_book_assets ON storage.objects;
CREATE POLICY update_book_assets ON storage.objects FOR UPDATE TO public
    USING (public.can_access_attachment_object(bucket, key, true))
    WITH CHECK (public.can_access_attachment_object(bucket, key, true));

DROP POLICY IF EXISTS delete_book_assets ON storage.objects;
CREATE POLICY delete_book_assets ON storage.objects FOR DELETE TO public
    USING (public.can_access_attachment_object(bucket, key, true));

NOTIFY pgrst, 'reload schema';
