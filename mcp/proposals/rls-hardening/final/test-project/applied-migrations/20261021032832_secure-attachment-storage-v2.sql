-- Step 9 (revision 2, 2026-10-21): RLS for attachment files in the `book-assets` bucket ONLY.
-- Supported by InsForge's storage guidance ("Managed Storage RLS": `storage.objects` policies belong in a custom migration;
-- skill insforge/storage/postgres-rls.md). Applied through `insforge db migrations` (runs as project_admin, one transaction).
--
-- Why revision 2: revision 1 (applied on TEST 2026-10-20 as migration 20261020133321) used a helper that returned TRUE for every
-- bucket other than `book-assets` - for reads AND writes - in policies granted to all roles, and asked for `GRANT ALL`. On a
-- project with other buckets (covers, avatars, ...) that would let any signed-in user read, overwrite or delete their objects.
-- Revision 2:
--   * every policy carries `bucket = 'book-assets'` itself, and the helper returns FALSE for any other bucket (defense in depth);
--     other buckets get NO policy from this migration, so their access is whatever their own policies / bucket settings say;
--   * privileges are the four the storage user API needs (SELECT, INSERT, UPDATE, DELETE), never ALL;
--   * writes only for `authenticated` callers who may edit the step's book; INSERT also requires `uploaded_by` = the caller;
--   * reads: OWNER/EDITOR/REVIEWER of the book, or anyone who may discover the book when the step has published text.
--     The anonymous part only works if the `anon` grants below take effect; on TEST (2026-10-20) they did NOT (see notes).
-- Keys must look like `<step uuid>/<file>` (that is what src/hooks/useAttachments.ts writes); anything else is denied.
--
-- Effects on OTHER buckets when RLS was disabled before (fresh installs): enabling RLS removes the previous "table grants let any
-- signed-in user do anything" access for buckets without policies. Downloads from PUBLIC buckets are unaffected (InsForge serves
-- them with root access, bypassing RLS); listing/metadata and all writes through the user API are then denied for those buckets
-- until they get their own policies. The website writes only to `book-assets`; check production buckets in the preflight.
-- Rollback: 09_rollback.sql (WARNING: re-opens cross-user downloads; see that file).

CREATE OR REPLACE FUNCTION public.can_access_attachment_object(target_bucket text, target_key text, check_write boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    first_segment text := split_part(target_key, '/', 1);
    target_book_id uuid;
    step_content jsonb;
    book_pub_status public.publication_status;
BEGIN
    -- Only book-assets is governed here; never grant anything for another bucket.
    IF target_bucket IS DISTINCT FROM 'book-assets' THEN
        RETURN false;
    END IF;
    IF first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN false;
    END IF;

    SELECT p.book_id, s.content, b.publication_status
      INTO target_book_id, step_content, book_pub_status
      FROM public.steps s
      JOIN public.phases p ON p.id = s.phase_id
      JOIN public.books b ON b.id = p.book_id
     WHERE s.id = first_segment::uuid
       AND b.deleted_at IS NULL;

    IF target_book_id IS NULL THEN
        RETURN false;
    END IF;

    IF check_write THEN
        RETURN public.can_edit_book(target_book_id, auth.uid());
    END IF;

    RETURN public.can_view_drafts(target_book_id, auth.uid())
        OR (public.can_discover_book(target_book_id, auth.uid())
            AND public.reader_markdown(step_content, book_pub_status) IS NOT NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_attachment_object(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_object(text, text, boolean) TO anon, authenticated;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Revision-1 policies (all roles, bucket-agnostic) are replaced; the drops also make this file safe to re-run.
DROP POLICY IF EXISTS select_book_assets ON storage.objects;
DROP POLICY IF EXISTS insert_book_assets ON storage.objects;
DROP POLICY IF EXISTS update_book_assets ON storage.objects;
DROP POLICY IF EXISTS delete_book_assets ON storage.objects;

CREATE POLICY select_book_assets ON storage.objects FOR SELECT TO authenticated, anon
    USING (bucket = 'book-assets' AND public.can_access_attachment_object(bucket, key, false));

CREATE POLICY insert_book_assets ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket = 'book-assets'
                AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
                AND public.can_access_attachment_object(bucket, key, true));

CREATE POLICY update_book_assets ON storage.objects FOR UPDATE TO authenticated
    USING      (bucket = 'book-assets' AND public.can_access_attachment_object(bucket, key, true))
    WITH CHECK (bucket = 'book-assets' AND public.can_access_attachment_object(bucket, key, true));

CREATE POLICY delete_book_assets ON storage.objects FOR DELETE TO authenticated
    USING (bucket = 'book-assets' AND public.can_access_attachment_object(bucket, key, true));

-- Privileges as InsForge documents them (RLS above decides the rows). No ALL, no TRUNCATE.
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
-- Anonymous readers of published attachments (documented public-read pattern). NOTE: on TEST the revision-1 equivalent of these
-- two grants did not take effect (anon had no privilege afterwards); the result is checked after applying and recorded.
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT ON storage.objects TO anon;

NOTIFY pgrst, 'reload schema';
