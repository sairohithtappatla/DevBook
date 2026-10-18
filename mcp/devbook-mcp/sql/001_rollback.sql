-- Rollback for 001_mcp_tokens.sql. Destroys every issued token (they stop working immediately).
BEGIN;
DROP TABLE IF EXISTS public.mcp_tokens;
NOTIFY pgrst, 'reload schema';
COMMIT;
