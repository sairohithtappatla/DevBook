-- DevBook MCP: OAuth 2.1 connections ("Connect DevBook" consent flow) and self-service personal tokens.
-- Depends on 001_mcp_tokens.sql. Apply as one transaction.
--
-- Model
--   mcp_oauth_clients         apps registered through dynamic client registration (public clients, PKCE only)
--   mcp_oauth_grants          one row per "connected app" a user approved; revoking it disconnects the app
--   mcp_oauth_codes           one-time authorization codes (hash only, 120 s, single use, PKCE S256 challenge)
--   mcp_oauth_refresh_tokens  rotating refresh tokens (hash only); presenting a used one revokes the whole grant
--   mcp_tokens                access tokens of both kinds: 'pat' (personal, from Settings or the CLI script) and
--                             'oauth' (1 hour, issued by the token endpoint, linked to a grant). The MCP function checks
--                             them exactly as before, so revoking a grant or a token takes effect on the next request.
--
-- Access
--   All tables: RLS on, no policies, nothing granted to anon/authenticated.
--   Browser (authenticated) may only call the mcp_my_* / mcp_create_personal_token / mcp_revoke_* functions and the two
--   consent-page functions; each acts on auth.uid() only.
--   The OAuth edge function (service credential = project_admin) calls mcp_oauth_register_client / _exchange_code /
--   _refresh; these are not executable by anon/authenticated.

CREATE TABLE public.mcp_oauth_clients (
    client_id     text        PRIMARY KEY CHECK (client_id ~ '^dbc_[A-Za-z0-9_-]{22}$'),
    client_name   text        NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 100),
    client_uri    text        CHECK (client_uri IS NULL OR char_length(client_uri) <= 500),
    redirect_uris text[]      NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 10),
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz
);
CREATE INDEX mcp_oauth_clients_created_idx ON public.mcp_oauth_clients (created_at);

CREATE TABLE public.mcp_oauth_grants (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    client_id    text        NOT NULL REFERENCES public.mcp_oauth_clients (client_id) ON DELETE CASCADE,
    scopes       text[]      NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'draft', 'publish']),
    created_at   timestamptz NOT NULL DEFAULT now(),
    revoked_at   timestamptz
);
CREATE INDEX mcp_oauth_grants_user_active_idx ON public.mcp_oauth_grants (user_id) WHERE revoked_at IS NULL;

CREATE TABLE public.mcp_oauth_codes (
    code_hash      text        PRIMARY KEY CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    client_id      text        NOT NULL REFERENCES public.mcp_oauth_clients (client_id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    redirect_uri   text        NOT NULL,
    code_challenge text        NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
    scopes         text[]      NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'draft', 'publish']),
    resource       text        CHECK (resource IS NULL OR char_length(resource) <= 500),
    created_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL,
    used_at        timestamptz,
    grant_id       uuid        REFERENCES public.mcp_oauth_grants (id) ON DELETE SET NULL
);
CREATE INDEX mcp_oauth_codes_user_created_idx ON public.mcp_oauth_codes (user_id, created_at);

CREATE TABLE public.mcp_oauth_refresh_tokens (
    token_hash text        PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    grant_id   uuid        NOT NULL REFERENCES public.mcp_oauth_grants (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);
CREATE INDEX mcp_oauth_refresh_grant_idx ON public.mcp_oauth_refresh_tokens (grant_id);

ALTER TABLE public.mcp_tokens ADD COLUMN grant_id uuid REFERENCES public.mcp_oauth_grants (id) ON DELETE CASCADE;
ALTER TABLE public.mcp_tokens DROP CONSTRAINT mcp_tokens_kind_check;
ALTER TABLE public.mcp_tokens ADD CONSTRAINT mcp_tokens_kind_check CHECK (kind IN ('pat', 'oauth'));
ALTER TABLE public.mcp_tokens ADD CONSTRAINT mcp_tokens_grant_matches_kind CHECK ((kind = 'oauth') = (grant_id IS NOT NULL));
CREATE INDEX mcp_tokens_grant_idx ON public.mcp_tokens (grant_id) WHERE grant_id IS NOT NULL;

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_oauth_clients, public.mcp_oauth_grants, public.mcp_oauth_codes, public.mcp_oauth_refresh_tokens FROM PUBLIC;

-- ------------------------------------------------------------------------------------------------ helpers
CREATE OR REPLACE FUNCTION public.mcp_sha256_hex(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO 'pg_catalog'
AS $function$
    SELECT encode(sha256(convert_to(p, 'UTF8')), 'hex')
$function$;

CREATE OR REPLACE FUNCTION public.mcp_valid_scopes(p_scopes text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
    -- every token needs 'read' (all tools start from reading); only the three known scopes
    SELECT p_scopes IS NOT NULL AND cardinality(p_scopes) BETWEEN 1 AND 3
       AND p_scopes <@ ARRAY['read', 'draft', 'publish'] AND 'read' = ANY (p_scopes)
$function$;

CREATE OR REPLACE FUNCTION public.mcp_require_user()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
    END IF;
    RETURN uid;
END
$function$;

-- Revokes a grant and everything issued from it. Internal (called by the functions below).
CREATE OR REPLACE FUNCTION public.mcp_revoke_grant_internal(p_grant_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
    UPDATE public.mcp_oauth_grants SET revoked_at = now() WHERE id = p_grant_id AND revoked_at IS NULL;
    UPDATE public.mcp_tokens SET revoked_at = now() WHERE grant_id = p_grant_id AND revoked_at IS NULL;
    UPDATE public.mcp_oauth_refresh_tokens SET used_at = coalesce(used_at, now()) WHERE grant_id = p_grant_id;
$function$;

-- ------------------------------------------------------------------------------------------------ browser: Settings → MCP Connect
CREATE OR REPLACE FUNCTION public.mcp_my_connections()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := public.mcp_require_user();
BEGIN
    RETURN jsonb_build_object(
        'tokens', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', t.id, 'label', t.label, 'prefix', t.token_prefix, 'scopes', to_jsonb(t.scopes),
                       'created_at', t.created_at, 'expires_at', t.expires_at, 'last_used_at', t.last_used_at)
                   ORDER BY t.created_at DESC)
              FROM public.mcp_tokens t
             WHERE t.user_id = uid AND t.kind = 'pat' AND t.revoked_at IS NULL AND t.expires_at > now()), '[]'::jsonb),
        'apps', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', g.id, 'client_name', c.client_name, 'client_uri', c.client_uri,
                       'redirect_uris', to_jsonb(c.redirect_uris), 'scopes', to_jsonb(g.scopes),
                       'created_at', g.created_at,
                       'last_used_at', (SELECT max(t.last_used_at) FROM public.mcp_tokens t WHERE t.grant_id = g.id))
                   ORDER BY g.created_at DESC)
              FROM public.mcp_oauth_grants g
              JOIN public.mcp_oauth_clients c ON c.client_id = g.client_id
             WHERE g.user_id = uid AND g.revoked_at IS NULL), '[]'::jsonb)
    );
END
$function$;

-- The browser generates the token and sends only its prefix and SHA-256 hash: the server never sees the token itself.
CREATE OR REPLACE FUNCTION public.mcp_create_personal_token(p_label text, p_prefix text, p_hash text, p_scopes text[], p_days integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := public.mcp_require_user();
    new_id uuid;
BEGIN
    IF p_label IS NULL OR p_label !~ '^[A-Za-z0-9 ._-]{1,80}$' THEN
        RAISE EXCEPTION 'label must be 1-80 characters from A-Z a-z 0-9 space . _ -' USING ERRCODE = '22023';
    END IF;
    IF p_prefix IS NULL OR p_prefix !~ '^[A-Za-z0-9_-]{8}$' OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'malformed token' USING ERRCODE = '22023';
    END IF;
    IF NOT public.mcp_valid_scopes(p_scopes) THEN
        RAISE EXCEPTION 'scopes must include read and only use read, draft, publish' USING ERRCODE = '22023';
    END IF;
    IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 365 THEN
        RAISE EXCEPTION 'days must be 1-365' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM public.mcp_tokens
         WHERE user_id = uid AND kind = 'pat' AND revoked_at IS NULL AND expires_at > now()) >= 20 THEN
        RAISE EXCEPTION 'too many active tokens (20); revoke one first' USING ERRCODE = '54000';
    END IF;
    INSERT INTO public.mcp_tokens (user_id, kind, token_prefix, token_hash, label, scopes, expires_at)
    VALUES (uid, 'pat', p_prefix, p_hash, p_label, (SELECT array_agg(DISTINCT s ORDER BY s) FROM unnest(p_scopes) s),
            now() + make_interval(days => p_days))
    RETURNING id INTO new_id;
    RETURN new_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.mcp_revoke_personal_token(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := public.mcp_require_user();
BEGIN
    UPDATE public.mcp_tokens SET revoked_at = now()
     WHERE id = p_id AND user_id = uid AND kind = 'pat' AND revoked_at IS NULL;
    RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.mcp_revoke_app(p_grant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := public.mcp_require_user();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.mcp_oauth_grants WHERE id = p_grant_id AND user_id = uid AND revoked_at IS NULL) THEN
        RETURN false;
    END IF;
    PERFORM public.mcp_revoke_grant_internal(p_grant_id);
    RETURN true;
END
$function$;

-- ------------------------------------------------------------------------------------------------ browser: consent page
-- What the consent page shows. NULL when the client is unknown. redirect_ok = the redirect URI is registered exactly.
CREATE OR REPLACE FUNCTION public.mcp_oauth_client_info(p_client_id text, p_redirect_uri text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    c public.mcp_oauth_clients;
BEGIN
    PERFORM public.mcp_require_user();
    SELECT * INTO c FROM public.mcp_oauth_clients WHERE client_id = p_client_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    RETURN jsonb_build_object('client_name', c.client_name, 'client_uri', c.client_uri,
                              'redirect_ok', p_redirect_uri = ANY (c.redirect_uris));
END
$function$;

-- The user clicked "Allow". Returns the one-time code for the redirect (only its hash is stored).
CREATE OR REPLACE FUNCTION public.mcp_oauth_issue_code(p_client_id text, p_redirect_uri text, p_code_challenge text, p_scopes text[], p_resource text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    uid uuid := public.mcp_require_user();
    code text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.mcp_oauth_clients WHERE client_id = p_client_id AND p_redirect_uri = ANY (redirect_uris)) THEN
        RAISE EXCEPTION 'unknown client or redirect URI' USING ERRCODE = '22023';
    END IF;
    IF p_code_challenge IS NULL OR p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' THEN
        RAISE EXCEPTION 'a PKCE S256 code challenge is required' USING ERRCODE = '22023';
    END IF;
    IF NOT public.mcp_valid_scopes(p_scopes) THEN
        RAISE EXCEPTION 'scopes must include read and only use read, draft, publish' USING ERRCODE = '22023';
    END IF;
    IF p_resource IS NOT NULL AND char_length(p_resource) > 500 THEN
        RAISE EXCEPTION 'resource too long' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM public.mcp_oauth_codes WHERE user_id = uid AND created_at > now() - interval '10 minutes') >= 30 THEN
        RAISE EXCEPTION 'too many authorization attempts; try again later' USING ERRCODE = '54000';
    END IF;
    DELETE FROM public.mcp_oauth_codes WHERE expires_at < now() - interval '1 day';
    -- 2 x 122 random bits from gen_random_uuid (v4)
    code := 'dbo_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.mcp_oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at)
    VALUES (public.mcp_sha256_hex(code), p_client_id, uid, p_redirect_uri, p_code_challenge,
            (SELECT array_agg(DISTINCT s ORDER BY s) FROM unnest(p_scopes) s), p_resource, now() + interval '120 seconds');
    RETURN code;
END
$function$;

-- ------------------------------------------------------------------------------------------------ OAuth edge function only
-- Dynamic client registration. false = registration rate limit reached (global, per hour).
CREATE OR REPLACE FUNCTION public.mcp_oauth_register_client(p_client_id text, p_client_name text, p_client_uri text, p_redirect_uris text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF (SELECT count(*) FROM public.mcp_oauth_clients WHERE created_at > now() - interval '1 hour') >= 300 THEN
        RETURN false;
    END IF;
    INSERT INTO public.mcp_oauth_clients (client_id, client_name, client_uri, redirect_uris)
    VALUES (p_client_id, p_client_name, p_client_uri, p_redirect_uris);
    RETURN true;
END
$function$;

-- Authorization code -> access + refresh token. The edge function generates both tokens and passes only their hashes,
-- plus base64url(sha256(code_verifier)) as p_challenge. Returns NULL for every invalid case (invalid_grant). The code is
-- burnt on the first attempt, valid or not; a second use of a code revokes the grant issued from it (RFC 6749 §4.1.2).
CREATE OR REPLACE FUNCTION public.mcp_oauth_exchange_code(p_code_hash text, p_client_id text, p_redirect_uri text, p_challenge text,
                                                          p_access_prefix text, p_access_hash text, p_access_ttl_seconds integer,
                                                          p_refresh_hash text, p_refresh_ttl_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    c public.mcp_oauth_codes;
    cl public.mcp_oauth_clients;
    gid uuid;
BEGIN
    SELECT * INTO c FROM public.mcp_oauth_codes WHERE code_hash = p_code_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    IF c.used_at IS NOT NULL THEN
        IF c.grant_id IS NOT NULL THEN
            PERFORM public.mcp_revoke_grant_internal(c.grant_id);
        END IF;
        RETURN NULL;
    END IF;
    UPDATE public.mcp_oauth_codes SET used_at = now() WHERE code_hash = p_code_hash;
    IF c.expires_at <= now() OR c.client_id IS DISTINCT FROM p_client_id OR c.redirect_uri IS DISTINCT FROM p_redirect_uri
       OR c.code_challenge IS DISTINCT FROM p_challenge THEN
        RETURN NULL;
    END IF;
    SELECT * INTO cl FROM public.mcp_oauth_clients WHERE client_id = c.client_id;

    INSERT INTO public.mcp_oauth_grants (user_id, client_id, scopes) VALUES (c.user_id, c.client_id, c.scopes) RETURNING id INTO gid;
    INSERT INTO public.mcp_tokens (user_id, kind, token_prefix, token_hash, label, scopes, expires_at, grant_id)
    VALUES (c.user_id, 'oauth', p_access_prefix, p_access_hash, left(cl.client_name, 80), c.scopes,
            now() + make_interval(secs => p_access_ttl_seconds), gid);
    INSERT INTO public.mcp_oauth_refresh_tokens (token_hash, grant_id, expires_at)
    VALUES (p_refresh_hash, gid, now() + make_interval(secs => p_refresh_ttl_seconds));
    UPDATE public.mcp_oauth_codes SET grant_id = gid WHERE code_hash = p_code_hash;
    UPDATE public.mcp_oauth_clients SET last_used_at = now() WHERE client_id = c.client_id;
    RETURN jsonb_build_object('scopes', to_jsonb(c.scopes), 'resource', c.resource);
END
$function$;

-- Refresh token rotation. NULL = invalid_grant. A refresh token that was already used (stolen and replayed, or a client
-- bug) revokes the whole grant, so both parties lose access and the user re-approves.
CREATE OR REPLACE FUNCTION public.mcp_oauth_refresh(p_refresh_hash text, p_client_id text,
                                                    p_access_prefix text, p_access_hash text, p_access_ttl_seconds integer,
                                                    p_new_refresh_hash text, p_refresh_ttl_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    rt public.mcp_oauth_refresh_tokens;
    g public.mcp_oauth_grants;
    cl public.mcp_oauth_clients;
BEGIN
    SELECT * INTO rt FROM public.mcp_oauth_refresh_tokens WHERE token_hash = p_refresh_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT * INTO g FROM public.mcp_oauth_grants WHERE id = rt.grant_id FOR UPDATE;
    IF g.client_id IS DISTINCT FROM p_client_id THEN
        RETURN NULL;
    END IF;
    IF rt.used_at IS NOT NULL THEN
        PERFORM public.mcp_revoke_grant_internal(g.id);
        RETURN NULL;
    END IF;
    IF g.revoked_at IS NOT NULL OR rt.expires_at <= now() THEN
        RETURN NULL;
    END IF;
    UPDATE public.mcp_oauth_refresh_tokens SET used_at = now() WHERE token_hash = p_refresh_hash;
    SELECT * INTO cl FROM public.mcp_oauth_clients WHERE client_id = g.client_id;
    INSERT INTO public.mcp_tokens (user_id, kind, token_prefix, token_hash, label, scopes, expires_at, grant_id)
    VALUES (g.user_id, 'oauth', p_access_prefix, p_access_hash, left(cl.client_name, 80), g.scopes,
            now() + make_interval(secs => p_access_ttl_seconds), g.id);
    INSERT INTO public.mcp_oauth_refresh_tokens (token_hash, grant_id, expires_at)
    VALUES (p_new_refresh_hash, g.id, now() + make_interval(secs => p_refresh_ttl_seconds));
    UPDATE public.mcp_oauth_clients SET last_used_at = now() WHERE client_id = g.client_id;
    -- expired access tokens of this grant are no longer useful
    DELETE FROM public.mcp_tokens WHERE grant_id = g.id AND expires_at < now() - interval '1 day';
    RETURN jsonb_build_object('scopes', to_jsonb(g.scopes));
END
$function$;

-- ------------------------------------------------------------------------------------------------ privileges
REVOKE EXECUTE ON FUNCTION public.mcp_sha256_hex(text), public.mcp_valid_scopes(text[]), public.mcp_require_user(),
    public.mcp_revoke_grant_internal(uuid), public.mcp_my_connections(),
    public.mcp_create_personal_token(text, text, text, text[], integer), public.mcp_revoke_personal_token(uuid),
    public.mcp_revoke_app(uuid), public.mcp_oauth_client_info(text, text),
    public.mcp_oauth_issue_code(text, text, text, text[], text),
    public.mcp_oauth_register_client(text, text, text, text[]),
    public.mcp_oauth_exchange_code(text, text, text, text, text, text, integer, text, integer),
    public.mcp_oauth_refresh(text, text, text, text, integer, text, integer) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.mcp_oauth_clients, public.mcp_oauth_grants, public.mcp_oauth_codes, public.mcp_oauth_refresh_tokens FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.mcp_oauth_clients, public.mcp_oauth_grants, public.mcp_oauth_codes, public.mcp_oauth_refresh_tokens FROM authenticated;
        GRANT EXECUTE ON FUNCTION public.mcp_my_connections(), public.mcp_create_personal_token(text, text, text, text[], integer),
            public.mcp_revoke_personal_token(uuid), public.mcp_revoke_app(uuid), public.mcp_oauth_client_info(text, text),
            public.mcp_oauth_issue_code(text, text, text, text[], text) TO authenticated;
        -- the helpers (mcp_require_user, mcp_valid_scopes, mcp_sha256_hex, mcp_revoke_grant_internal) stay private: the
        -- SECURITY DEFINER functions above run as their owner, who can always execute them
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'project_admin') THEN
        GRANT EXECUTE ON FUNCTION public.mcp_oauth_register_client(text, text, text, text[]),
            public.mcp_oauth_exchange_code(text, text, text, text, text, text, integer, text, integer),
            public.mcp_oauth_refresh(text, text, text, text, integer, text, integer) TO project_admin;
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
