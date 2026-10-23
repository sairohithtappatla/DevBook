import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { McpService, type OAuthClientInfo } from "@/services/mcp.service";
import {
  buildRedirect, MCP_SCOPES, parseAuthorizeRequest, redirectHost, rememberOAuthReturn, SCOPE_INFO, type McpScope,
} from "@/lib/mcp-connect";

// "Connect DevBook": the authorization endpoint of DevBook's OAuth server (see mcp/devbook-oauth/handler.ts).
// The app is identified by client_id; DevBook only ever redirects to a redirect URI that app registered.

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 shadow-sm">{children}</div>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{message}</p>
          <p className="mt-3 text-xs text-muted-foreground">Close this window and start the connection again from the app.</p>
        </div>
      </div>
    </Card>
  );
}

export function OAuthConsentPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isEmailVerified, isInitializing, signOut } = useAuth();
  const origin = window.location.origin;
  const parsed = useMemo(() => parseAuthorizeRequest(window.location.search, origin), [origin]);

  const [client, setClient] = useState<OAuthClientInfo | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [scopes, setScopes] = useState<McpScope[]>(parsed.ok ? parsed.request.scopes : []);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signedIn = isAuthenticated && isEmailVerified;
  const ids = parsed.ok ? parsed.request : parsed.partial;

  useEffect(() => {
    if (!signedIn || !ids) return;
    let alive = true;
    McpService.oauthClientInfo(ids.clientId, ids.redirectUri)
      .then((c) => { if (alive) setClient(c); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [signedIn, ids]);

  // A malformed request from a known app with a registered redirect URI is reported back to the app (RFC 6749 §4.1.2.1).
  useEffect(() => {
    if (parsed.ok || !parsed.redirectable || !parsed.partial || !client?.redirect_ok) return;
    window.location.replace(buildRedirect(parsed.partial.redirectUri, { error: parsed.error, error_description: parsed.description, state: parsed.partial.state, iss: origin }));
  }, [parsed, client, origin]);

  const goSignIn = () => {
    rememberOAuthReturn(window.location.pathname + window.location.search);
    navigate({ to: "/login" });
  };
  const switchAccount = async () => {
    rememberOAuthReturn(window.location.pathname + window.location.search);
    await signOut();
    navigate({ to: "/login" });
  };

  if (!parsed.ok && !parsed.redirectable) return <ErrorCard title="This connection link is not valid" message={parsed.description} />;
  if (isInitializing) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking your session…</div>
      </Card>
    );
  }
  if (!signedIn) {
    return (
      <Card>
        <ShieldCheck className="w-6 h-6 text-foreground mb-3" />
        <h1 className="text-base font-semibold text-foreground">Sign in to connect an app to DevBook</h1>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">An app wants to access your DevBook account. Sign in first; you will see exactly what it asks for before anything is shared.</p>
        <button onClick={goSignIn} className="mt-5 w-full rounded-lg bg-foreground text-background px-3.5 py-2 text-xs font-medium hover:opacity-90 cursor-pointer">Sign in to DevBook</button>
      </Card>
    );
  }
  if (loadError) return <ErrorCard title="Could not load this request" message="DevBook could not check the app right now. Please try again in a moment." />;
  if (client === undefined) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      </Card>
    );
  }
  if (client === null) return <ErrorCard title="Unknown app" message="This app is not registered with DevBook. It may have been removed, or the link was changed." />;
  if (!client.redirect_ok) return <ErrorCard title="Redirect address not allowed" message="The app asked DevBook to send you to an address it did not register. For your safety nothing was shared." />;
  if (!parsed.ok) return <ErrorCard title="The app sent an invalid request" message={parsed.description} />;

  const req = parsed.request;
  const host = redirectHost(req.redirectUri);
  const isWeb = req.redirectUri.startsWith("https://");

  const toggle = (s: McpScope) => {
    if (SCOPE_INFO[s].required) return;
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : MCP_SCOPES.filter((x) => x === s || cur.includes(x))));
  };

  const deny = () => {
    window.location.replace(buildRedirect(req.redirectUri, { error: "access_denied", error_description: "The user denied access.", state: req.state, iss: origin }));
  };
  const allow = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const code = await McpService.oauthIssueCode({ clientId: req.clientId, redirectUri: req.redirectUri, codeChallenge: req.codeChallenge, scopes, resource: req.resource });
      window.location.replace(buildRedirect(req.redirectUri, { code, state: req.state, iss: origin }));
    } catch (err) {
      setBusy(false);
      setSubmitError(err instanceof Error && /too many/.test(err.message) ? "Too many attempts. Wait a few minutes and try again." : "Something went wrong. Please try again.");
    }
  };

  return (
    <Card>
      <ShieldCheck className="w-6 h-6 text-foreground mb-3" />
      <h1 className="text-base font-semibold text-foreground">
        <span className="break-words">{client.client_name}</span> wants to access your DevBook account
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user?.email}</span>.{" "}
        <button onClick={switchAccount} className="underline hover:text-foreground cursor-pointer">Not you?</button>
      </p>

      <div className="mt-4 rounded-lg border border-hairline bg-background p-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">This app will be able to</div>
        <div className="space-y-2">
          {MCP_SCOPES.filter((s) => req.scopes.includes(s)).map((s) => (
            <label key={s} className={`flex items-start gap-2 text-xs ${SCOPE_INFO[s].required ? "" : "cursor-pointer"}`}>
              <input type="checkbox" checked={scopes.includes(s)} disabled={SCOPE_INFO[s].required || busy} onChange={() => toggle(s)} className="mt-0.5" />
              <span>
                <span className="font-medium text-foreground">{SCOPE_INFO[s].title}</span>
                {SCOPE_INFO[s].required && <span className="text-muted-foreground"> (required)</span>}
                <span className="block text-muted-foreground">{SCOPE_INFO[s].description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        After you allow access you return to <span className="font-mono text-foreground break-all">{isWeb ? host : req.redirectUri}</span>
        {isWeb ? "." : " (an app on your computer)."} Only connect apps you trust. App names are chosen by the app itself.
        You can disconnect it any time in Settings → MCP Connect.
      </p>

      {submitError && <p className="mt-3 text-xs text-danger">{submitError}</p>}

      <div className="mt-5 flex gap-2">
        <button onClick={deny} disabled={busy} className="flex-1 rounded-lg border border-hairline px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-40 cursor-pointer">Cancel</button>
        <button onClick={allow} disabled={busy || scopes.length === 0} className="flex-1 rounded-lg bg-foreground text-background px-3.5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer">
          {busy ? "Connecting…" : "Allow"}
        </button>
      </div>
    </Card>
  );
}
