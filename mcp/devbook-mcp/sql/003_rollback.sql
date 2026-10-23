-- Rollback of 003_mcp_oauth.sql. Disconnects every OAuth app (their access tokens are deleted) and removes the OAuth tables
-- and functions. Personal tokens ('pat') are kept and keep working.
BEGIN;

DROP FUNCTION IF EXISTS public.mcp_oauth_refresh(text, text, text, text, integer, text, integer);
DROP FUNCTION IF EXISTS public.mcp_oauth_exchange_code(text, text, text, text, text, text, integer, text, integer);
DROP FUNCTION IF EXISTS public.mcp_oauth_register_client(text, text, text, text[]);
DROP FUNCTION IF EXISTS public.mcp_oauth_issue_code(text, text, text, text[], text);
DROP FUNCTION IF EXISTS public.mcp_oauth_client_info(text, text);
DROP FUNCTION IF EXISTS public.mcp_revoke_app(uuid);
DROP FUNCTION IF EXISTS public.mcp_revoke_personal_token(uuid);
DROP FUNCTION IF EXISTS public.mcp_create_personal_token(text, text, text, text[], integer);
DROP FUNCTION IF EXISTS public.mcp_my_connections();
DROP FUNCTION IF EXISTS public.mcp_revoke_grant_internal(uuid);
DROP FUNCTION IF EXISTS public.mcp_require_user();
DROP FUNCTION IF EXISTS public.mcp_valid_scopes(text[]);
DROP FUNCTION IF EXISTS public.mcp_sha256_hex(text);

DELETE FROM public.mcp_tokens WHERE kind = 'oauth';
DROP INDEX IF EXISTS public.mcp_tokens_grant_idx;
ALTER TABLE public.mcp_tokens DROP CONSTRAINT IF EXISTS mcp_tokens_grant_matches_kind;
ALTER TABLE public.mcp_tokens DROP CONSTRAINT IF EXISTS mcp_tokens_kind_check;
ALTER TABLE public.mcp_tokens ADD CONSTRAINT mcp_tokens_kind_check CHECK (kind IN ('pat'));
ALTER TABLE public.mcp_tokens DROP COLUMN IF EXISTS grant_id;

DROP TABLE IF EXISTS public.mcp_oauth_refresh_tokens;
DROP TABLE IF EXISTS public.mcp_oauth_codes;
DROP TABLE IF EXISTS public.mcp_oauth_grants;
DROP TABLE IF EXISTS public.mcp_oauth_clients;

NOTIFY pgrst, 'reload schema';
COMMIT;
