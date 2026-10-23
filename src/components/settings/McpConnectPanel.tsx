import { useMemo, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Link2, Plug, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useCreatePersonalToken, useMcpConnections, useRevokeMcpApp, useRevokePersonalToken } from "@/hooks/useMcp";
import { generatePersonalToken, LABEL_RE, MCP_SCOPES, mcpResourceUrl, redirectHost, SCOPE_INFO, type McpScope } from "@/lib/mcp-connect";

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          showToast("Could not copy. Select the text and copy it manually.", "error");
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-hairline bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
      aria-label={label}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ScopeChips({ scopes }: { scopes: McpScope[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <span key={s} className="font-mono text-[10px] uppercase bg-surface-2 border border-hairline px-1.5 py-0.5 rounded text-muted-foreground">
          {s}
        </span>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const CLIENTS: { name: string; steps: string; snippet?: (url: string) => string }[] = [
  { name: "ChatGPT", steps: "Settings → Apps & Connectors → add a custom connector (developer mode) with the server URL. ChatGPT opens DevBook so you can sign in and allow access." },
  { name: "Claude (web and desktop)", steps: "Settings → Connectors → Add custom connector, paste the server URL, then Connect. Claude opens DevBook so you can sign in and allow access." },
  { name: "Claude Code", steps: "Run the command, then type /mcp in Claude Code and choose DevBook to sign in.", snippet: (url) => `claude mcp add --transport http devbook ${url}` },
  { name: "Cursor", steps: "Add this to ~/.cursor/mcp.json. Cursor asks you to sign in to DevBook the first time.", snippet: (url) => JSON.stringify({ mcpServers: { devbook: { url } } }, null, 2) },
  { name: "VS Code", steps: "Add this to .vscode/mcp.json and start the server. VS Code asks you to sign in to DevBook.", snippet: (url) => JSON.stringify({ servers: { devbook: { type: "http", url } } }, null, 2) },
];

export function McpConnectPanel() {
  const { showToast } = useToast();
  const { data, isLoading, isError, refetch } = useMcpConnections();
  const createToken = useCreatePersonalToken();
  const revokeToken = useRevokePersonalToken();
  const revokeApp = useRevokeMcpApp();

  const serverUrl = useMemo(() => mcpResourceUrl(window.location.origin), []);
  const [openClient, setOpenClient] = useState<string | null>("ChatGPT");

  const [label, setLabel] = useState("");
  const [days, setDays] = useState(90);
  const [scopes, setScopes] = useState<McpScope[]>([...MCP_SCOPES]);
  const [newToken, setNewToken] = useState<string | null>(null);

  const toggleScope = (s: McpScope) => {
    if (SCOPE_INFO[s].required) return;
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : MCP_SCOPES.filter((x) => x === s || cur.includes(x))));
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = label.trim();
    if (!LABEL_RE.test(name)) {
      showToast("Name: 1-80 letters, numbers, spaces, dots, dashes or underscores.", "warning");
      return;
    }
    try {
      const t = await generatePersonalToken();
      await createToken.mutateAsync({ label: name, prefix: t.prefix, hash: t.hash, scopes, days });
      setNewToken(t.token);
      setLabel("");
    } catch (err) {
      const msg = err instanceof Error && /too many active tokens/.test(err.message) ? "You have 20 active tokens. Revoke one first." : "Could not create the token.";
      showToast(msg, "error");
    }
  };

  const onRevokeToken = async (id: string, name: string) => {
    if (!window.confirm(`Revoke the token "${name}"? Apps using it stop working immediately.`)) return;
    try {
      await revokeToken.mutateAsync(id);
      showToast("Token revoked", "success");
    } catch {
      showToast("Could not revoke the token.", "error");
    }
  };

  const onDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Disconnect ${name}? It loses access to DevBook immediately and must ask you again to reconnect.`)) return;
    try {
      await revokeApp.mutateAsync(id);
      showToast(`${name} disconnected`, "success");
    } catch {
      showToast("Could not disconnect the app.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <Section icon={Plug} title="Connect an AI app" subtitle="Use DevBook from ChatGPT, Claude, Cursor and other MCP clients. You approve each app and choose what it may do.">
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-background px-3 py-2">
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">Server URL</span>
          <code className="flex-1 truncate text-xs font-mono text-foreground">{serverUrl}</code>
          <CopyButton text={serverUrl} />
        </div>
        <div className="mt-4 divide-y divide-hairline rounded-lg border border-hairline">
          {CLIENTS.map((c) => {
            const open = openClient === c.name;
            return (
              <div key={c.name}>
                <button
                  type="button"
                  onClick={() => setOpenClient(open ? null : c.name)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                  aria-expanded={open}
                >
                  {c.name}
                  <span className="text-muted-foreground">{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.steps}</p>
                    {c.snippet && (
                      <div className="relative">
                        <pre className="overflow-x-auto rounded-md border border-hairline bg-surface-2 p-3 pr-20 text-[11px] font-mono text-foreground">{c.snippet(serverUrl)}</pre>
                        <div className="absolute right-2 top-2"><CopyButton text={c.snippet(serverUrl)} /></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Connected apps" subtitle="Apps you allowed through the DevBook sign-in screen. Disconnecting takes effect immediately.">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-3">Loading…</p>
        ) : isError ? (
          <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
            Could not load your connections.
            <button onClick={() => refetch()} className="underline cursor-pointer text-foreground">Retry</button>
          </div>
        ) : data && data.apps.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {data.apps.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-semibold text-foreground truncate">{a.client_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Returns to {redirectHost(a.redirect_uris[0] ?? "")} · connected {formatDate(a.created_at)} · last used {formatDate(a.last_used_at)}
                  </div>
                  <ScopeChips scopes={a.scopes} />
                </div>
                <button
                  onClick={() => onDisconnect(a.id, a.client_name)}
                  disabled={revokeApp.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[11px] font-medium text-danger hover:bg-surface-2 disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <Link2 className="w-3 h-3" /> Disconnect
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground py-3">No apps connected yet. Add DevBook in an AI app with the server URL above.</p>
        )}
      </Section>

      <Section icon={KeyRound} title="Personal tokens" subtitle="For tools that only accept a token in a header. Treat a token like a password: anyone who has it can act as you within its permissions.">
        {newToken && (
          <div className="mb-4 rounded-lg border border-warning bg-surface-2 p-3 space-y-2" role="status">
            <p className="text-xs font-semibold text-foreground">Copy your new token now. It is shown only once.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-hairline bg-background px-2 py-1.5 text-[11px] font-mono text-foreground">{newToken}</code>
              <CopyButton text={newToken} />
            </div>
            <p className="text-[11px] text-muted-foreground">Send it as the header <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> to {serverUrl}.</p>
            <button onClick={() => setNewToken(null)} className="text-[11px] underline text-muted-foreground hover:text-foreground cursor-pointer">I saved it</button>
          </div>
        )}

        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-hairline bg-background p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Token name, e.g. work laptop"
              maxLength={80}
              className="flex-1 bg-background border border-hairline rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label="Token name"
            />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-background border border-hairline rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none"
              aria-label="Expires after"
            >
              <option value={30}>Expires in 30 days</option>
              <option value={90}>Expires in 90 days</option>
              <option value={365}>Expires in 1 year</option>
            </select>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Permissions</legend>
            {MCP_SCOPES.map((s) => (
              <label key={s} className={`flex items-start gap-2 text-xs ${SCOPE_INFO[s].required ? "opacity-80" : "cursor-pointer"}`}>
                <input type="checkbox" checked={scopes.includes(s)} disabled={SCOPE_INFO[s].required} onChange={() => toggleScope(s)} className="mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">{SCOPE_INFO[s].title}</span>
                  {SCOPE_INFO[s].required && <span className="text-muted-foreground"> (required)</span>}
                  <span className="block text-muted-foreground">{SCOPE_INFO[s].description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            disabled={createToken.isPending || label.trim().length === 0}
            className="rounded-lg bg-foreground text-background px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {createToken.isPending ? "Creating…" : "Create token"}
          </button>
        </form>

        {data && data.tokens.length > 0 && (
          <ul className="mt-4 divide-y divide-hairline">
            {data.tokens.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-semibold text-foreground truncate">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">dbk_{t.prefix}_…</div>
                  <div className="text-[11px] text-muted-foreground">
                    Created {formatDate(t.created_at)} · expires {formatDate(t.expires_at)} · last used {formatDate(t.last_used_at)}
                  </div>
                  <ScopeChips scopes={t.scopes} />
                </div>
                <button
                  onClick={() => onRevokeToken(t.id, t.label)}
                  disabled={revokeToken.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[11px] font-medium text-danger hover:bg-surface-2 disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" /> Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
