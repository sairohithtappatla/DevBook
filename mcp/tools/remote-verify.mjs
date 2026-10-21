// Authenticated end-to-end verification of the DEPLOYED DevBook MCP function on the InsForge TEST project.
// Never targets production: refuses app key 6ktij8hk and any URL whose app key differs from EXPECTED_TEST_APPKEY.
// Never prints tokens: they are read from environment variables only and redacted from every output line.
//
//   EXPECTED_TEST_APPKEY=393cz2pc MCP_URL=https://393cz2pc.function2.insforge.app/devbook-mcp \
//   DBK_OWNER=... DBK_EDITOR=... DBK_REVIEWER=... DBK_VIEWER=... DBK_STRANGER=... [DBK_OWNER2=...] \
//   node mcp/tools/remote-verify.mjs [--writes] [--publish] [--burst=150] [--legacy-step=<test-created step id> --expect-legacy=refused|migrated]
//
// Default: READ-ONLY checks (nothing is written). --writes needs DEVBOOK_MCP_WRITE_TOOLS=true on the function and creates
// disposable phases/steps titled "rv-<run id>" in the book "Fixture Public" (cleanup SQL is printed at the end; run it
// yourself after approval). --publish needs DEVBOOK_MCP_PUBLISH_TOOL=true and publishes ONE of those disposable steps.
// Expects the seed of mcp/proposals/rls-hardening/final/test-project/10_seed_fixture.sql (owner/editor/reviewer/viewer/stranger).
const PROD = "6ktij8hk";
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) ?? `=${d}`).split("=")[1];
const die = (m) => { console.error("STOP: " + m); process.exit(2); };

const url = process.env.MCP_URL ?? "";
const expected = (process.env.EXPECTED_TEST_APPKEY ?? "").toLowerCase();
const m = /^https:\/\/([a-z0-9]+)\.function2\.insforge\.app\/[a-z0-9-]+$/.exec(url);
if (!m) die("MCP_URL must look like https://<appkey>.function2.insforge.app/<slug>");
if (m[1] === PROD || expected === PROD) die("refusing the production app key");
if (!/^[a-z0-9]{6,12}$/.test(expected) || m[1] !== expected) die("MCP_URL app key must equal EXPECTED_TEST_APPKEY");

const TOK = Object.fromEntries(["OWNER", "EDITOR", "REVIEWER", "VIEWER", "STRANGER", "OWNER2"].map((r) => [r.toLowerCase(), process.env[`DBK_${r}`] ?? ""]));
const secrets = Object.values(TOK).filter(Boolean);
const redact = (s) => secrets.reduce((acc, t) => acc.split(t).join("<token>"), String(s)).replace(/dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}/g, "<token>");
const run = Math.random().toString(36).slice(2, 8);
const results = [];
const record = (name, status, detail = "") => { results.push({ name, status, detail: redact(detail).slice(0, 200) }); console.log(`${status.padEnd(4)} ${name}${detail ? "  " + redact(detail).slice(0, 200) : ""}`); };
const check = (name, ok, detail) => record(name, ok ? "PASS" : "FAIL", ok ? "" : detail);
const need = (...roles) => roles.every((r) => TOK[r]);

let rid = 0;
async function post(token, body, extraHeaders = {}) {
  const t0 = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json, ms: Date.now() - t0, requestId: res.headers.get("x-request-id") };
}
const rpc = (token, method, params = {}) => post(token, { jsonrpc: "2.0", id: ++rid, method, params });
async function tool(role, name, args = {}) {
  const r = await rpc(TOK[role], "tools/call", { name, arguments: args });
  const sc = r.json?.result?.structuredContent ?? null;
  return { ...r, data: sc, code: sc?.error?.code ?? null };
}

// ---------------------------------------------------------------- 1. transport and authentication (no token needed)
{
  const bodies = new Set();
  for (const t of [null, "garbage", `dbk_${"A".repeat(8)}_${"B".repeat(43)}`]) { const r = await rpc(t, "tools/list"); bodies.add(`${r.status}:${r.text}`); }
  check("401 identical for missing / garbage / unknown token", bodies.size === 1 && [...bodies][0].startsWith("401:"), [...bodies].join(" | "));
  const g = await fetch(url, { method: "GET" });
  check("GET -> 405", g.status === 405, String(g.status));
  const o = await post(null, { jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin: "https://evil.example" });
  check("browser Origin -> 403", o.status === 403, String(o.status));
  const u = await rpc(null, "tools/list");
  check("x-request-id on error responses", /^[0-9a-f-]{36}$/.test(u.requestId ?? ""), String(u.requestId));
}

// ---------------------------------------------------------------- 2. read tools per role
let PUB = null, draftStep = null, legacyStep = null;
if (!need("owner", "viewer", "reviewer", "stranger")) record("role read checks", "SKIP", "set DBK_OWNER, DBK_REVIEWER, DBK_VIEWER, DBK_STRANGER");
else {
  const init = await rpc(TOK.owner, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "remote-verify", version: "1" } });
  check("initialize (owner)", init.status === 200 && !!init.json?.result?.protocolVersion, init.text);
  const list = await rpc(TOK.owner, "tools/list");
  const names = (list.json?.result?.tools ?? []).map((t) => t.name);
  record("tools/list (owner) -> " + names.join(","), names.length >= 6 ? "PASS" : "FAIL");
  const books = await tool("owner", "search_books", { limit: 25 });
  const titles = (books.data?.books ?? []).map((b) => b.title);
  PUB = (books.data?.books ?? []).find((b) => b.title === "Fixture Public")?.id ?? null;
  check("owner search_books lists the fixture books, not the soft-deleted one", !!PUB && !titles.includes("Fixture Deleted"), titles.join(","));
  check("x-request-id on tool responses", /^[0-9a-f-]{36}$/.test(books.requestId ?? ""), String(books.requestId));
  if (PUB) {
    const own = await tool("owner", "get_book_structure", { book_id: PUB });
    const allSteps = (own.data?.phases ?? []).flatMap((p) => p.steps);
    draftStep = allSteps.find((s) => s.title === "Draft-only step")?.id ?? null;
    // legacy-shaped step for the LEGACY_STEP check: only an explicitly named, test-created step (never seeded content)
    legacyStep = opt("legacy-step", "") || null;
    const rev = await tool("reviewer", "get_book_structure", { book_id: PUB });
    check("reviewer sees the draft-only step and phase D", rev.text.includes("Draft-only step") && rev.text.includes("Phase D"), rev.text);
    const v = await tool("viewer", "get_book_structure", { book_id: PUB });
    check("viewer structure has no draft step, no draft-only phase title", v.status === 200 && !v.text.includes("Draft-only step") && !v.text.includes("Phase D") && !v.text.includes("DRAFT_SECRET"), v.text);
    if (draftStep) {
      const d = await tool("viewer", "get_step_content", { step_id: draftStep });
      check("viewer get_step_content(draft-only step) -> NOT_FOUND", d.code === "NOT_FOUND", d.text);
    }
    const vs = await tool("viewer", "search_content", { query: "DRAFT_SECRET" });
    check("viewer search_content finds no draft text", (vs.data?.results ?? []).length === 0, vs.text);
    const os = await tool("owner", "search_content", { query: "DRAFT_SECRET" });
    check("owner search_content finds draft text (control)", (os.data?.results ?? []).length > 0, os.text);
    const s = await tool("stranger", "get_book_metadata", { book_id: PUB });
    check("stranger get_book_metadata(owner's book) -> NOT_FOUND", s.code === "NOT_FOUND", s.text);
    const val = await tool("owner", "get_book_metadata", { book_id: "not-a-uuid-LEAK_PROBE" });
    check("VALIDATION without echoing the input", val.code === "VALIDATION" && !val.text.includes("LEAK_PROBE"), val.text);
  }
}

// ---------------------------------------------------------------- 3. writes (disposable fixtures only)
let rvStep = null;
if (flag("writes")) {
  if (!need("owner", "editor", "reviewer", "viewer") || !PUB) record("write checks", "SKIP", "needs all role tokens and the fixture book");
  else {
    const ph = await tool("editor", "create_phase", { book_id: PUB, title: `rv-${run}` });
    check("editor create_phase", ph.data?.created === true, ph.text);
    const phaseId = ph.data?.phase?.id;
    for (const r of ["viewer", "reviewer"]) { const x = await tool(r, "create_phase", { book_id: PUB, title: `rv-${run}-x` }); check(`${r} create_phase -> FORBIDDEN_ROLE`, x.code === "FORBIDDEN_ROLE", x.text); }
    const d = await tool("editor", "create_draft", { phase_id: phaseId, title: `rv-${run} draft`, markdown: `RV_DRAFT_${run}` });
    check("editor create_draft", d.data?.created === true, d.text);
    rvStep = d.data?.step?.id ?? null;
    const v = await tool("viewer", "get_book_structure", { book_id: PUB });
    check("viewer cannot see the new draft or its phase", !v.text.includes(`rv-${run}`), v.text);
    const stale = await tool("editor", "update_draft", { step_id: rvStep, expected_revision: "2000-01-01T00:00:00.000000+00:00", markdown: "x", change_summary: "stale" });
    check("update_draft with a stale revision -> CONFLICT", stale.code === "CONFLICT", stale.text);
    if (legacyStep) {
      const want = opt("expect-legacy", "refused");
      const cur = await tool("editor", "get_step_content", { step_id: legacyStep });
      const l = await tool("editor", "update_draft", { step_id: legacyStep, expected_revision: cur.data?.revision ?? "x", markdown: `RV_LEGACY_${run}`, change_summary: "legacy probe" });
      if (want === "refused") check("update_draft on a legacy-shaped step -> LEGACY_STEP", l.code === "LEGACY_STEP", l.text);
      else check("update_draft on the migrated legacy step succeeds", !l.code, l.text);
      const vl = await tool("viewer", "get_book_structure", { book_id: PUB });
      check("readers never see the legacy draft edit", !vl.text.includes(`RV_LEGACY_${run}`), vl.text);
    }
    // 10 parallel creates on the same parent
    const par = await Promise.all(Array.from({ length: 10 }, (_, i) => tool("owner", "create_draft", { phase_id: phaseId, title: `rv-${run} p${i}`, markdown: `p${i}` })));
    const okN = par.filter((r) => r.data?.created === true).length;
    const codes = par.filter((r) => r.code).map((r) => r.code);
    const s = await tool("owner", "get_book_structure", { book_id: PUB });
    const positions = (s.data?.phases ?? []).find((p) => p.id === phaseId)?.steps.map((x) => x.position) ?? [];
    check("10 parallel create_draft: all succeed, positions unique", okN === 10 && new Set(positions).size === positions.length, `ok=${okN} codes=${codes.join(",")} positions=${positions.join(",")}`);
    // retry of the same create is idempotent
    const again = await tool("editor", "create_draft", { phase_id: phaseId, title: `rv-${run} draft`, markdown: `RV_DRAFT_${run}` });
    check("retried create_draft returns the existing step (created:false)", again.data?.created === false, again.text);
  }
}

// ---------------------------------------------------------------- 4. publishing (owner only, one disposable step)
if (flag("publish")) {
  if (!rvStep) record("publish checks", "SKIP", "run together with --writes");
  else {
    const e = await tool("editor", "publish_draft", { step_id: rvStep });
    check("editor publish_draft -> FORBIDDEN_ROLE (owner-only)", e.code === "FORBIDDEN_ROLE", e.text);
    const pv = await tool("owner", "publish_draft", { step_id: rvStep });
    check("owner preview returns a confirmation token", !!pv.data?.confirmation_token, pv.text);
    const title = pv.data?.title;
    if (TOK.owner2) {
      const x = await tool("owner2", "publish_draft", { step_id: rvStep, confirm: true, confirmation_token: pv.data?.confirmation_token, confirm_title: title });
      check("another token of the same owner cannot redeem the confirmation", x.code === "CONFIRMATION_INVALID", x.text);
    } else record("cross-token confirmation", "SKIP", "set DBK_OWNER2 (second token of the owner)");
    const done = await tool("owner", "publish_draft", { step_id: rvStep, confirm: true, confirmation_token: pv.data?.confirmation_token, confirm_title: title });
    check("owner confirm publishes", done.data?.published === true, done.text);
    const v = await tool("viewer", "get_step_content", { step_id: rvStep });
    check("viewer now reads the published text", v.data?.markdown === `RV_DRAFT_${run}`, v.text);
    const replay = await tool("owner", "publish_draft", { step_id: rvStep, confirm: true, confirmation_token: pv.data?.confirmation_token, confirm_title: title });
    check("replayed confirmation -> CONFLICT", replay.code === "CONFLICT", replay.text);
  }
}

// ---------------------------------------------------------------- 5. controlled burst (reads, one token)
const burst = Number(opt("burst", "0"));
if (burst > 0) {
  if (!TOK.viewer) record("burst", "SKIP", "set DBK_VIEWER");
  else {
    const t0 = Date.now();
    const out = await Promise.all(Array.from({ length: Math.min(burst, 300) }, () => tool("viewer", "search_books", {})));
    const by = {};
    for (const r of out) { const k = r.code ?? String(r.status); by[k] = (by[k] ?? 0) + 1; }
    record(`burst of ${out.length} reads in ${Date.now() - t0} ms -> ${JSON.stringify(by)}`, "INFO");
  }
}

const fails = results.filter((r) => r.status === "FAIL").length;
console.log(`\nRESULT: ${fails ? "FAIL" : "PASS"} (${results.filter((r) => r.status === "PASS").length} pass, ${fails} fail, ${results.filter((r) => r.status === "SKIP").length} skip) run id ${run}`);
if (flag("writes")) console.log(`Cleanup (run only after approval, in the TEST folder): delete from public.phases where title like 'rv-${run}%';`);
process.exit(fails ? 1 : 0);
