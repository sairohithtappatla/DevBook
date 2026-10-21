-- Step 1 of 3: the three access predicates. PROPOSAL. NOT APPLIED to any real backend.
--   can_read_book      PERMISSION to read a book              (D-b: unpublished books are members-only)
--   can_discover_book  may the book appear in lists/search    (D-c: UNLISTED is link-only, members excepted)
--   can_view_drafts    may see unpublished step content       (D-a: OWNER, EDITOR, REVIEWER)
-- can_read_book changes; can_discover_book and can_view_drafts are new; can_manage_members gets SECURITY DEFINER
-- (a pre-existing recursion defect found by the sandbox, see below). Run on the TEST backend first.
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

-- Discoverability is permission to read MINUS "unlisted for non-members". Members still see their own unlisted books.
CREATE OR REPLACE FUNCTION public.can_discover_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    b RECORD;
BEGIN
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

-- Who may see UNPUBLISHED step content: OWNER, EDITOR, REVIEWER. VIEWER and everyone else: published text only.
CREATE OR REPLACE FUNCTION public.can_view_drafts(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
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

-- PRE-EXISTING DEFECT, reproduced in the sandbox with your exact function and policy text (NOT yet confirmed on your
-- live backend): can_manage_members is the only access helper that is not SECURITY DEFINER, yet it reads book_members
-- and is called by a policy ON book_members (modify_members). For a non-owner member of a book they cannot read (in the
-- original rules: a soft-deleted book) the policy re-enters itself and every query scanning that row fails with SQLSTATE
-- 54001 (stack depth; deterministic, see final/README.md). Same body, now SECURITY DEFINER like can_edit_book / can_delete_book / can_read_book.
CREATE OR REPLACE FUNCTION public.can_manage_members(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM book_members
        WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER'
    );
END;
$function$;

-- Policies run with the caller's rights, so anon and authenticated need EXECUTE on the new predicates. Stated
-- explicitly instead of relying on the default PUBLIC grant (a backend with restrictive default privileges would
-- otherwise break every policy that calls them).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT EXECUTE ON FUNCTION public.can_discover_book(uuid, uuid), public.can_view_drafts(uuid, uuid) TO anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.can_discover_book(uuid, uuid), public.can_view_drafts(uuid, uuid) TO authenticated;
    END IF;
END
$$;

COMMIT;
