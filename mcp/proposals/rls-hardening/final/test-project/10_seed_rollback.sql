-- Removes ONLY the fixture created by 10_seed_fixture.sql (books with slugs fx-*; phases, steps, attachments, members, progress cascade).
-- The five example.invalid users and their public.users rows are left in place; delete them separately if wanted.
BEGIN;
DELETE FROM public.books WHERE slug IN ('fx-public', 'fx-empty', 'fx-unlisted', 'fx-draft', 'fx-deleted');
COMMIT;
