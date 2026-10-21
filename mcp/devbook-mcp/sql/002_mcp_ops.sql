-- DevBook MCP operations tables: shared per-token rate limits and a durable audit trail. PROPOSAL. NOT APPLIED to any
-- backend. Needs 001_mcp_tokens.sql. Used only when the function runs with DEVBOOK_MCP_DURABLE_LIMITS=true /
-- DEVBOOK_MCP_DURABLE_AUDIT=true, so deploying the function before this migration is safe (both default OFF).
-- Closed to the browser like mcp_tokens: RLS on with no policies, no privileges for PUBLIC/anon/authenticated.
-- The audit table stores ids, outcome codes, revisions and a SHA-256 of written content only: never tokens, titles or Markdown.
BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_rate_limits (
    token_id     uuid        NOT NULL REFERENCES public.mcp_tokens (id) ON DELETE CASCADE,
    bucket       text        NOT NULL CHECK (bucket IN ('read', 'write', 'publish')),
    window_start timestamptz NOT NULL,
    hits         integer     NOT NULL DEFAULT 0 CHECK (hits >= 0),
    PRIMARY KEY (token_id, bucket, window_start)
);

CREATE TABLE IF NOT EXISTS public.mcp_audit_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    at              timestamptz NOT NULL DEFAULT now(),
    request_id      uuid        NOT NULL,
    token_id        uuid        NOT NULL,  -- no FK: audit rows must outlive deleted tokens
    user_id         uuid        NOT NULL,
    tool            text        NOT NULL CHECK (tool ~ '^[a-z_]{1,40}$'),
    book_id         uuid,
    step_id         uuid,
    outcome         text        NOT NULL CHECK (outcome ~ '^[A-Za-z_:]{1,60}$'),
    revision_before text        CHECK (char_length(revision_before) <= 40),
    revision_after  text        CHECK (char_length(revision_after) <= 40),
    content_sha256  text        CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS mcp_audit_events_at_idx ON public.mcp_audit_events (at);
CREATE INDEX IF NOT EXISTS mcp_audit_events_user_at_idx ON public.mcp_audit_events (user_id, at);

ALTER TABLE public.mcp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_rate_limits, public.mcp_audit_events FROM PUBLIC;

-- Fixed-window counter, atomic through the primary-key upsert (concurrent calls from any isolate serialize on the row).
-- Returns true while the window's count is within the limit. A fixed window can let up to 2 x limit through around a
-- window boundary; that is accepted and documented. Old windows of the same token/bucket are pruned on the way.
CREATE OR REPLACE FUNCTION public.mcp_rate_take(p_token uuid, p_bucket text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    w timestamptz;
    n integer;
BEGIN
    -- Belt and braces on top of the REVOKE below: never usable from the browser roles.
    IF current_user IN ('anon', 'authenticated') OR current_setting('role', true) IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
    END IF;
    IF p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 3600 OR p_bucket NOT IN ('read', 'write', 'publish') THEN
        RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
    END IF;
    w := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds);
    INSERT INTO public.mcp_rate_limits AS r (token_id, bucket, window_start, hits)
    VALUES (p_token, p_bucket, w, 1)
    ON CONFLICT (token_id, bucket, window_start) DO UPDATE SET hits = r.hits + 1
    RETURNING r.hits INTO n;
    DELETE FROM public.mcp_rate_limits
     WHERE token_id = p_token AND bucket = p_bucket AND window_start < w;
    RETURN n <= p_limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mcp_rate_take(uuid, text, integer, integer) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.mcp_rate_limits, public.mcp_audit_events FROM anon;
        REVOKE EXECUTE ON FUNCTION public.mcp_rate_take(uuid, text, integer, integer) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.mcp_rate_limits, public.mcp_audit_events FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.mcp_rate_take(uuid, text, integer, integer) FROM authenticated;
    END IF;
    -- [A, verify on TEST] The admin key of the function must be able to execute it. If that role is neither the owner nor a
    -- superuser, grant it explicitly here once its name is known (Q1 of preflight/readonly-queries.sql lists the roles).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'project_admin') THEN
        GRANT EXECUTE ON FUNCTION public.mcp_rate_take(uuid, text, integer, integer) TO project_admin;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
