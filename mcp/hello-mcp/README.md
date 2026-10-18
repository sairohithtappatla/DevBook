# hello-mcp: isolated runtime probe

Question this answers: **can InsForge Edge Functions host the official MCP SDK over stateless Streamable HTTP?**
It has no database access, no InsForge client, reads no environment variables or secrets, and does not touch the DevBook frontend or data.

## Files and what gets deployed

| File | Deployed? | Purpose |
|------|-----------|---------|
| `handler.ts` | **Yes, only this file** (`--file mcp/hello-mcp/handler.ts`) | The function |
| `handler.test.ts` | No | 15 Deno tests against the deployable file |
| `local-server.ts` | No | Local `Deno.serve` shim for manual testing |
| `deno.json` | No | Local tasks; keeps Deno from using the repo's `package.json` |
| `verify.mjs` | No | Black-box checker (Node 18+, any OS) |

The CLI reads exactly the one path in `--file` and uploads its text as `code`; there is no directory upload and no default path (CLI source: `resolveDeployFilePath` throws if `--file` is missing). `local-server.ts` and the tests cannot be deployed by this command.

## Behaviour (all asserted by tests)

| Request | Response |
|---------|----------|
| `POST initialize` | 200, protocol negotiated, `tools` capability, no `Mcp-Session-Id` |
| `POST tools/list` | 200, tool `echo` (`text` string 1-200, read-only annotations) |
| `POST tools/call echo` | 200 with the text |
| invalid args | 200 with `isError:true` (MCP semantics) |
| unknown method | 200, JSON-RPC error `-32601` |
| notification (no `id`) | 202, empty body |
| malformed JSON / bad UTF-8 / empty body | 400, `-32700` |
| non-JSON `Content-Type` | 415 |
| body > 16 KB (declared or chunked) | 413; chunked bodies stop being read at the cap |
| browser `Origin` header | 403 (allowlist is empty) |
| missing `Accept: application/json, text/event-stream` | 406 (SDK) |
| `GET`, `DELETE`, `PUT`, `PATCH`, `HEAD`, `OPTIONS` | 405 with `Allow: POST` |
| unexpected exception | 500, `-32603`, no stack trace; logs only the error class |

## Local results (reproduced this session, local Deno 2.9.6 only, NOT InsForge)
- `deno task test`: **15 passed, 0 failed** (includes type-check and a test that scans `handler.ts` code for env/DB/InsForge/fetch use).
- `node verify.mjs http://127.0.0.1:8787/hello-mcp` against `deno task serve`: **13/13 matched**.

## Assumptions to resolve BEFORE deploying
1. ~~Export contract~~ **Resolved by the official docs** (`npx @insforge/cli docs functions typescript`, your output): functions are TypeScript on Deno with `export default async function (req: Request): Promise<Response>` and static `import ... from 'npm:...'`. `handler.ts` follows that shape exactly. The `module.exports = async function(request)` text in the installed `@insforge/mcp` package is stale; a short-lived rework of the probe to that form was reverted.
2. **`npm:` imports.** The hosted build must resolve `npm:@modelcontextprotocol/sdk@1.32.1` and `npm:zod@3.25.76`. This is the thing the probe tests; a failed build shows in the deploy output's build logs.
3. **Routing.** The URL below is derived from SDK source and unconfirmed. The deploy result prints the authoritative URL.

## Deployment plan (run by you; nothing has been deployed)

Prerequisite: `npx @insforge/cli current` shows the DevBook project (do not paste keys).

**1. Command**
```bash
npx @insforge/cli functions deploy hello-mcp --file mcp/hello-mcp/handler.ts --name "hello-mcp (runtime probe)" --description "Isolated MCP SDK runtime probe. No DB, no secrets. Safe to delete."
```
This performs `GET /api/functions/hello-mcp` (exists?), then `POST /api/functions` (create) or `PUT` (update). It creates one function and nothing else: no table, secret, bucket, or schedule.

**2. Expected result**
- Success: `Function "hello-mcp" creation success.` then `Deployment: success -> <url>`.
- Failure: `Deployment: failed` + build logs, and the CLI exits non-zero. **The function record may already exist even though the build failed** (CLI source creates the function, then reports the deployment status).

**3. Expected endpoint** (use whatever URL the deploy prints; these are the derived candidates)
- `https://6ktij8hk.function2.insforge.app/hello-mcp` (SDK: `https://{appKey}.function2.insforge.app/{slug}`)
- fallback proxy path: `https://6ktij8hk.ap-southeast.insforge.app/functions/hello-mcp` (SDK: `/functions/${slug}`)

**4. Verification**
```bash
node mcp/hello-mcp/verify.mjs https://6ktij8hk.function2.insforge.app/hello-mcp
```
Expected: `13/13 matched expectations.` Each line is `PASS`/`FAIL` with want/got status.
If every line is 401/403 with non-JSON-RPC bodies, the platform requires authentication before reaching the function (the script says so). Then set your project's **public anon key** in your own shell as `HELLO_MCP_BEARER` and rerun; the script sends it and never prints it. Paste only the script output.

Per-case expectations:

| # | Case | Want |
|---|------|------|
| 1 | initialize | 200, body has `protocolVersion` |
| 2 | tools/list | 200, has `echo` |
| 3 | echo ok | 200, text `hello` |
| 4 | echo bad type | 200, `isError:true` |
| 5 | unknown method | 200, `-32601` |
| 6 | malformed JSON | 400, `-32700` |
| 7 | wrong content-type | 415 |
| 8-10 | GET / DELETE / PUT | 405 |
| 11 | browser Origin | 403 |
| 12 | notification | 202 |
| 13 | oversize body | 413 |

Any deviation is a finding to report. In particular, a platform-injected CORS/Origin behaviour, a 5xx from cold start, or a gateway body limit lower than 16 KB would show up here.

**5. Cleanup**
```bash
npx @insforge/cli functions delete hello-mcp -y
npx @insforge/cli functions list
```
`list` must no longer show `hello-mcp`.

**6. Rollback if the deploy fails**
Same cleanup command (deletes the half-created function). No database, secret, or frontend state was touched, so there is nothing else to undo. If `delete` errors, paste the error; do not try other endpoints.

**7. Possible charges / quota**
One deploy plus ~13 invocations per run. Sources (search snippets, not a live pricing table) put the Free plan at ~100,000 edge function calls per month, so this is negligible; confirm on your dashboard. Build minutes consumed by a deploy are not documented in anything I could fetch. The function remains deployed until you delete it; idle Free projects pause after 7 days without requests.

## What a pass proves and does not prove

Proves: the SDK imports and runs on InsForge's hosted Deno; stateless JSON-mode Streamable HTTP works through the platform; method/error handling survives the gateway; reachability over HTTPS; whether the platform demands its own authentication.
Does not prove: database access from a function, secret handling, user-scoped clients, limits (timeout/memory/quota), concurrency, ChatGPT or Claude compatibility, or OAuth. Those need separate checks.

## Local reproduction
```bash
cd mcp/hello-mcp
deno task test                                   # needs Deno >= 2
deno task serve                                  # terminal 1
node verify.mjs http://127.0.0.1:8787/hello-mcp  # terminal 2
```
