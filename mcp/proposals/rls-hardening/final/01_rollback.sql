-- Rollback for 01_access_predicates.sql. Run 03_rollback.sql and 02_rollback.sql FIRST.
-- can_read_book is restored exactly as read from your backend on 2026-10-18 (`db functions --json`).
-- Before applying anything, also save your own snapshot and diff it against this text.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_book(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    book_access_level access_level;
    owner_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM books WHERE id = target_book_id AND deleted_at IS NOT NULL) THEN
        RETURN EXISTS (SELECT 1 FROM book_members WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER');
    END IF;

    SELECT access_level INTO book_access_level FROM books WHERE id = target_book_id;

    IF book_access_level = 'PUBLIC' OR book_access_level = 'UNLISTED' THEN
        RETURN TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM book_members WHERE book_id = target_book_id AND user_id = req_user_id) THEN
        RETURN TRUE;
    END IF;

    IF book_access_level = 'FOLLOWERS_ONLY' THEN
        SELECT user_id INTO owner_id FROM book_members WHERE book_id = target_book_id AND role = 'OWNER' LIMIT 1;
        IF EXISTS (SELECT 1 FROM user_followers WHERE follower_id = req_user_id AND following_id = owner_id) THEN
            RETURN TRUE;
        END IF;
    END IF;

    IF book_access_level = 'SELECTED_USERS' THEN
        IF EXISTS (SELECT 1 FROM book_access WHERE book_id = target_book_id AND user_id = req_user_id) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_members(target_book_id uuid, req_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM book_members
        WHERE book_id = target_book_id AND user_id = req_user_id AND role = 'OWNER'
    );
END;
$function$;

DROP FUNCTION IF EXISTS public.can_view_drafts(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_discover_book(uuid, uuid);

COMMIT;
