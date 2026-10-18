-- Synthetic fixture for the TEST project (same titles/markers as ../../rpc-expectations.mjs and the sandbox). NOT for production.
-- Prerequisite: five users exist in auth.users with these e-mails (create them through the API sign-up, then mark them verified; the
-- preflight found that requireEmailVerification applies and that setting email_verified = true in auth.users on the TEST project works):
--   owner@example.invalid  editor@example.invalid  reviewer@example.invalid  viewer@example.invalid  stranger@example.invalid
-- Runs as the project admin (bypasses RLS). Safe to run once; it stops if the fixture already exists. Rollback: 10_seed_rollback.sql.
BEGIN;
DO $$
DECLARE
    o uuid; e uuid; r uuid; v uuid; s uuid;
    b_pub uuid := gen_random_uuid(); b_empty uuid := gen_random_uuid(); b_unl uuid := gen_random_uuid(); b_draft uuid := gen_random_uuid(); b_del uuid := gen_random_uuid();
    p uuid; st1 uuid := gen_random_uuid(); st2 uuid := gen_random_uuid();
BEGIN
    SELECT id INTO o FROM auth.users WHERE email = 'owner@example.invalid';
    SELECT id INTO e FROM auth.users WHERE email = 'editor@example.invalid';
    SELECT id INTO r FROM auth.users WHERE email = 'reviewer@example.invalid';
    SELECT id INTO v FROM auth.users WHERE email = 'viewer@example.invalid';
    SELECT id INTO s FROM auth.users WHERE email = 'stranger@example.invalid';
    IF o IS NULL OR e IS NULL OR r IS NULL OR v IS NULL OR s IS NULL THEN RAISE EXCEPTION 'create the five example.invalid users first'; END IF;
    IF EXISTS (SELECT 1 FROM public.books WHERE slug IN ('fx-public', 'fx-empty', 'fx-unlisted', 'fx-draft', 'fx-deleted')) THEN RAISE EXCEPTION 'fixture already loaded'; END IF;

    INSERT INTO public.users (id, name) VALUES (o, 'Owner'), (e, 'Editor'), (r, 'Reviewer'), (v, 'Viewer'), (s, 'Stranger') ON CONFLICT (id) DO NOTHING;

    -- the owner membership of each book is added by trigger_add_book_owner from created_by
    INSERT INTO public.books (id, title, slug, description, publication_status, access_level, created_by) VALUES
        (b_pub,   'Fixture Public',   'fx-public',   'published, public',  'PUBLISHED', 'PUBLIC',   o),
        (b_empty, 'Fixture Empty',    'fx-empty',    'no steps',           'PUBLISHED', 'PUBLIC',   o),
        (b_unl,   'Fixture Unlisted', 'fx-unlisted', 'link only',          'PUBLISHED', 'UNLISTED', o),
        (b_draft, 'Fixture Draft',    'fx-draft',    'draft book',         'DRAFT',     'PUBLIC',   o);
    INSERT INTO public.books (id, title, slug, description, publication_status, access_level, created_by, deleted_at)
        VALUES (b_del, 'Fixture Deleted', 'fx-deleted', 'soft deleted', 'PUBLISHED', 'PUBLIC', o, now());
    INSERT INTO public.book_members (book_id, user_id, role) VALUES
        (b_pub, e, 'EDITOR'), (b_pub, r, 'REVIEWER'), (b_pub, v, 'VIEWER'),
        (b_del, e, 'EDITOR'), (b_del, v, 'VIEWER');   -- non-owner members of a soft-deleted book: triggers the can_manage_members recursion

    -- PUB
    INSERT INTO public.phases (book_id, title, position) VALUES (b_pub, 'Phase A', 1), (b_pub, 'Phase B', 2), (b_pub, 'Phase C (no steps)', 3), (b_pub, 'Phase D (draft only)', 4);
    SELECT id INTO p FROM public.phases WHERE book_id = b_pub AND title = 'Phase A';
    INSERT INTO public.steps (id, phase_id, title, position, content) VALUES
        (st1, p, 'Published step', 1, '{"slug":"published-step","status":"Published","markdown":"DRAFT-EDIT-1 newer unpublished text","publishedMarkdown":"PUB-1 published text","description":"d1","difficulty":"Intermediate","estimatedTime":7,"visibility":"Public"}'),
        (st2, p, 'Draft-only step', 2, '{"slug":"draft-only","status":"Draft","markdown":"DRAFT_SECRET only an editor may read","description":"d2"}');
    INSERT INTO public.attachments (step_id, file_name, storage_path, file_type, file_size) VALUES (st1, 'pub.pdf', 'fixture/pub.pdf', 'application/pdf', 10), (st2, 'draft.pdf', 'fixture/draft.pdf', 'application/pdf', 20);
    SELECT id INTO p FROM public.phases WHERE book_id = b_pub AND title = 'Phase B';
    INSERT INTO public.steps (phase_id, title, position, content) VALUES (p, 'Legacy step', 1, '{"markdown":"LEGACY text of a step without status"}');
    SELECT id INTO p FROM public.phases WHERE book_id = b_pub AND title = 'Phase D (draft only)';
    INSERT INTO public.steps (phase_id, title, position, content) VALUES (p, 'Draft in phase D', 1, '{"status":"Draft","markdown":"DRAFT_SECRET phase D"}');
    -- EMPTY
    INSERT INTO public.phases (book_id, title, position) VALUES (b_empty, 'Only phase', 1);
    -- UNLISTED
    INSERT INTO public.phases (book_id, title, position) VALUES (b_unl, 'Unlisted phase', 1);
    SELECT id INTO p FROM public.phases WHERE book_id = b_unl;
    INSERT INTO public.steps (phase_id, title, position, content) VALUES (p, 'Unlisted step', 1, '{"slug":"unl","status":"Published","markdown":"UNL text","publishedMarkdown":"UNL text"}');
    -- DRAFT book
    INSERT INTO public.phases (book_id, title, position) VALUES (b_draft, 'Draft phase', 1);
    SELECT id INTO p FROM public.phases WHERE book_id = b_draft;
    INSERT INTO public.steps (phase_id, title, position, content) VALUES (p, 'Step of a draft book', 1, '{"status":"Published","markdown":"DRAFT_SECRET book","publishedMarkdown":"DRAFT_SECRET book"}');
    -- DELETED book
    INSERT INTO public.phases (book_id, title, position) VALUES (b_del, 'Deleted phase', 1);
    SELECT id INTO p FROM public.phases WHERE book_id = b_del;
    INSERT INTO public.steps (phase_id, title, position, content) VALUES (p, 'Deleted step', 1, '{"status":"Published","markdown":"gone","publishedMarkdown":"gone"}');
END
$$;
COMMIT;
