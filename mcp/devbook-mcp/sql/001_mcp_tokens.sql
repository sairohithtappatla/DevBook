-- DevBook MCP personal access tokens. PROPOSAL. NOT APPLIED to any backend. Needs your explicit approval.
-- Differences from context/mcp-phase2-design.md section 1.3: token_hash is lowercase HEX TEXT (64 chars) instead of bytea, so
-- an equality filter through the HTTP API needs no bytea escaping [A]; everything else is as designed.
-- Closed to the browser: RLS on, no policies, all privileges revoked from anon/authenticated. Only the service credential
-- used by the Edge Function can read or write it [A: how InsForge maps that credential to a Postgres role is unverified,
-- see mcp/devbook-mcp/README.md; FORCE ROW LEVEL SECURITY is deliberately not used].
BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kind          text        NOT NULL DEFAULT 'pat' CHECK (kind IN ('pat')),
    token_prefix  text        NOT NULL CHECK (token_prefix ~ '^[A-Za-z0-9_-]{8}$'),
    token_hash    text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    label         text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    scopes        text[]      NOT NULL DEFAULT ARRAY['read', 'draft'] CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'draft', 'publish']),
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
    revoked_at    timestamptz,
    last_used_at  timestamptz,
    CONSTRAINT mcp_tokens_expiry_after_create CHECK (expires_at > created_at),
    CONSTRAINT mcp_tokens_max_lifetime CHECK (expires_at <= created_at + interval '365 days')
);

CREATE INDEX IF NOT EXISTS mcp_tokens_user_active_idx ON public.mcp_tokens (user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_tokens FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.mcp_tokens FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.mcp_tokens FROM authenticated;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
