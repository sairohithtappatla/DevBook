-- Step 4 (OPTIONAL, after 01-03): permission helpers answer only for the CALLER.
-- Finding N3: every helper takes a user id and is callable through the API (PostgREST exposes public functions as RPC
-- unless EXECUTE is revoked). As SECURITY DEFINER they bypass RLS, so anyone could ask "is user X the owner/editor of
-- book Y" for arbitrary ids. EXECUTE must stay granted to anon/authenticated (policies run as the caller and call these),
-- so the fix is inside the function: for the roles anon/authenticated, a req_user_id different from auth.uid() returns
-- FALSE. Trusted roles (service/admin, migrations) are unaffected. PROPOSAL. NOT APPLIED to any real backend.
-- ASSUMPTION [A]: the API sets the Postgres role GUC ('role') to anon/authenticated (PostgREST does with SET LOCAL ROLE).
-- If InsForge does not, the guard never fires: behaviour equals today's, nothing breaks. Test project must confirm it fires.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    b RECORD;
    owner_id UUID;
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    SELECT access_level, publication_status, deleted_at INTO b FROM books WHERE id = target_book_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Soft-deleted books: owner only (unchanged).
    IF b.deleted_at IS NOT NULL THEN
        RETURN EXISTS (SELECT 1 FROM book_members WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER');
    END IF;

    -- Members of any role (OWNER, EDITOR, REVIEWER, VIEWER) always read their own book, published or not.
    IF EXISTS (SELECT 1 FROM book_members WHERE book_id = target_book_id AND user_id = req_user_id) THEN
        RETURN TRUE;
    END IF;

    -- Everyone else: DRAFT and ARCHIVED books are invisible, whatever their access level.
    IF b.publication_status <> 'PUBLISHED' THEN
        RETURN FALSE;
    END IF;

    IF b.access_level = 'PUBLIC' OR b.access_level = 'UNLISTED' THEN
        RETURN TRUE;
    END IF;

    IF b.access_level = 'FOLLOWERS_ONLY' THEN
        SELECT user_id INTO owner_id FROM book_members WHERE book_id = target_book_id AND role = 'OWNER' LIMIT 1;
        IF EXISTS (SELECT 1 FROM user_followers WHERE follower_id = req_user_id AND following_id = owner_id) THEN
            RETURN TRUE;
        END IF;
    END IF;

    IF b.access_level = 'SELECTED_USERS' THEN
        IF EXISTS (SELECT 1 FROM book_access WHERE book_id = target_book_id AND user_id = req_user_id) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_discover_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    b RECORD;
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    IF NOT public.can_read_book(target_book_id, req_user_id) THEN
        RETURN FALSE;
    END IF;

    SELECT access_level INTO b FROM books WHERE id = target_book_id;

    IF b.access_level <> 'UNLISTED' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (SELECT 1 FROM book_members WHERE book_id = target_book_id AND user_id = req_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_drafts(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1
          FROM book_members bm
          JOIN books b ON b.id = bm.book_id
         WHERE bm.book_id = target_book_id
           AND bm.user_id = req_user_id
           AND bm.role IN ('OWNER', 'EDITOR', 'REVIEWER')
           AND (b.deleted_at IS NULL OR bm.role = 'OWNER')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_members(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM book_members
        WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.step_is_reader_visible(target_step_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
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

CREATE OR REPLACE FUNCTION public.can_edit_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM book_members
        WHERE book_id = target_book_id AND user_id = req_user_id AND role IN ('OWNER', 'EDITOR')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_delete_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 04: the caller may only ask about itself. Policies always pass auth.uid(), so they are unaffected.
    IF current_setting('role', true) IN ('anon', 'authenticated') AND req_user_id IS DISTINCT FROM auth.uid() THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM book_members
        WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER'
    );
END;
$function$;

COMMIT;
