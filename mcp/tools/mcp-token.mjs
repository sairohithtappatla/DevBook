// Generates a DevBook MCP personal access token and the SQL that registers its HASH. Pure local computation: no network,
// no database call, nothing written to disk. The token itself is printed ONCE to stderr; stdout carries only SQL (hash, never
// the token), so `node mcp-token.mjs ... > insert.sql` cannot capture the secret by accident.
//
//   node mcp/tools/mcp-token.mjs --email you@example.com --label "claude code laptop" [--scopes read,draft] [--days 90]
//   node mcp/tools/mcp-token.mjs --revoke-prefix AbCdEf12          (prints the revoke SQL only)
//
// Run the printed SQL yourself, from the TEST project folder after mcp/proposals/rls-hardening/preflight/guard.mjs passed
// (`npx @insforge/cli db query "<sql>"`). The script has no way to reach any project.
import crypto from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]] : a), []));
const die = (m) => { console.error("Error: " + m); process.exit(2); };

if (args["revoke-prefix"]) {
  if (!/^[A-Za-z0-9_-]{8}$/.test(args["revoke-prefix"])) die("--revoke-prefix must be the 8 characters after 'dbk_'");
  console.log(`update public.mcp_tokens set revoked_at = now() where token_prefix = '${args["revoke-prefix"]}' and revoked_at is null;`);
  process.exit(0);
}
const email = args.email, label = args.label ?? "", scopes = (args.scopes ?? "read,draft").split(","), days = Number(args.days ?? 90);
if (!email || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) die("--email is required (the account that owns the token)");
if (!/^[A-Za-z0-9 ._-]{1,80}$/.test(label)) die("--label is required: 1-80 characters from A-Z a-z 0-9 space . _ -");
if (!scopes.length || !scopes.every((s) => ["read", "draft", "publish"].includes(s))) die("--scopes must be a comma list of read,draft,publish");
if (!Number.isInteger(days) || days < 1 || days > 365) die("--days must be 1-365");

const b64url = (b) => b.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const id = b64url(crypto.randomBytes(6)).slice(0, 8);
const token = `dbk_${id}_${b64url(crypto.randomBytes(32))}`; // 8 + 43 url-safe characters
if (!/^dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/.test(token)) die("internal: token format");
const hash = crypto.createHash("sha256").update(token).digest("hex");

console.log(`-- registers token ${id} for ${email} (scopes: ${scopes.join(",")}; ${days} days). Contains the HASH only.
insert into public.mcp_tokens (user_id, token_prefix, token_hash, label, scopes, expires_at)
select u.id, '${id}', '${hash}', '${label}', array[${scopes.map((s) => `'${s}'`).join(",")}], now() + interval '${days} days'
from auth.users u where u.email = '${email}';`);
console.error(`\n=== TOKEN (shown once; store it in a password manager or an environment variable, never in a file in the repo) ===\n${token}\n=== end ===\nThe SQL on stdout registers only its SHA-256 hash. Check that exactly 1 row is inserted; 0 rows means the e-mail is unknown.`);
