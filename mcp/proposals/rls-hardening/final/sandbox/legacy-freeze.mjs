// 02b (legacy-step freeze), 07 (strict reader rule), 02c (optional freeze of 'Published' steps without published text) and
// 06 (search_path pin): behaviour and rollback (sandbox only, native PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... node legacy-freeze.mjs
// Step kinds in the fixture:
//   rule-4 legacy  = no status, PUBLISHED book, markdown string  -> genuine published content: 02b freezes it
//   rule-2 shape   = status 'Published', no publishedMarkdown    -> may be an unapproved draft (editor autosave bug): 02b leaves
//                    it, 07 hides it, 02c freezes it only on an explicit owner decision
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST)) { console.error("Refusing: PGHOST must be a local disposable PostgreSQL."); process.exit(2); }
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const here = path.dirname(fileURLToPath(import.meta.url));
const final = path.resolve(here, "..");
const sql = (f) => fs.readFileSync(path.join(final, f), "utf8");

const OWNER = "c0000000-0000-0000-0000-000000000001", EDITOR = "c0000000-0000-0000-0000-000000000002";
const PUB = "b0000000-0000-0000-0000-000000000001", DRAFTBOOK = "b0000000-0000-0000-0000-000000000002";
const PH = "f0000000-0000-0000-0000-00000000000a", PH2 = "f0000000-0000-0000-0000-00000000000b";
const S = {
  pubNoPm: "50000000-0000-0000-0000-000000000001", noStatus: "50000000-0000-0000-0000-000000000002", draft: "50000000-0000-0000-0000-000000000003",
  hasPm: "50000000-0000-0000-0000-000000000004", pubNumber: "50000000-0000-0000-0000-000000000005", draftBook: "50000000-0000-0000-0000-000000000006",
  noStatus2: "50000000-0000-0000-0000-000000000007",
};
const ORIGINAL = {
  [S.pubNoPm]: { status: "Published", markdown: "OLD_A", slug: "a" },          // rule-2 shape
  [S.noStatus]: { markdown: "OLD_B" },                                         // rule-4 legacy
  [S.draft]: { status: "Draft", markdown: "DRAFT_C" },
  [S.hasPm]: { status: "Published", markdown: "NEWER_D", publishedMarkdown: "PUB_D" },
  [S.pubNumber]: { status: "Published", markdown: 5, publishedMarkdown: null }, // rule-2 shape, odd types
  [S.draftBook]: { markdown: "OLD_F" },                                        // no status, DRAFT book: not visible
  [S.noStatus2]: { markdown: "OLD_G" },                                        // rule-4 legacy
};

const checks = [];
const check = (name, ok, detail = "") => { checks.push(ok); console.log(`${ok ? "ok  " : "BAD "} ${name}${detail ? "  " + detail : ""}`); };

const name = "lf_" + Math.random().toString(36).slice(2, 8);
const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
const c = new pg.Client({ database: name }); await c.connect();
const notices = [];
c.on("notice", (n) => notices.push(n.message));
try {
  await c.query(sql("sandbox/schema.sql"));
  for (const f of ["01_access_predicates.sql", "02_reader_objects.sql"]) await c.query(sql(f));
  for (const [id, n] of [[OWNER, "owner"], [EDITOR, "editor"]]) { await c.query("insert into auth.users(id,email) values ($1,$2)", [id, `${n}@x.invalid`]); await c.query("insert into users(id,name) values ($1,$2)", [id, n]); }
  await c.query("insert into books(id,title,slug,publication_status,access_level,created_by) values ($1,'pub','pub','PUBLISHED','PUBLIC',$3),($2,'drf','drf','DRAFT','PUBLIC',$3)", [PUB, DRAFTBOOK, OWNER]);
  await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'EDITOR')", [PUB, EDITOR]);
  await c.query("insert into phases(id,book_id,title,position) values ($1,$2,'P',1),($3,$4,'Q',1)", [PH, PUB, PH2, DRAFTBOOK]);
  let pos = 0;
  for (const [id, content] of Object.entries(ORIGINAL)) await c.query("insert into steps(id,phase_id,title,position,content) values ($1,$2,$3,$4,$5::jsonb)", [id, id === S.draftBook ? PH2 : PH, `step ${pos + 1}`, ++pos, JSON.stringify(content)]);

  const as = async (user, q, params = []) => {
    await c.query("begin");
    try {
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
      await c.query(user ? "set local role authenticated" : "set local role anon");
      return (await c.query(q, params)).rows;
    } finally { await c.query("rollback"); }
  };
  const anonTree = async () => JSON.stringify((await as(null, "select reader_book_tree($1::uuid,false) t", [PUB]))[0].t);
  const content = async (id) => (await c.query("select content from steps where id=$1", [id])).rows[0].content;
  const fnBody = async () => (await c.query("select prosrc from pg_proc where proname = 'reader_markdown'")).rows[0].prosrc;
  // jsonb reorders object keys, so compare canonically (sorted keys)
  const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : 1))) : x));
  const same = async (id) => canon(await content(id)) === canon(ORIGINAL[id]);

  // (1) the defect, demonstrated inside a transaction that is rolled back
  await c.query("begin");
  await c.query(`update steps set content = content || '{"markdown":"LEAK_CHECK"}'::jsonb where id = any($1::uuid[])`, [[S.pubNoPm, S.noStatus]]);
  const leaked = (await c.query("select reader_book_tree($1::uuid,false)::text t", [PUB])).rows[0].t.includes("LEAK_CHECK");
  await c.query("rollback");
  check("without 02b/07, editing a legacy step's markdown reaches readers (defect reproduced)", leaked);

  // (1b) 07 refuses before 02b (genuine legacy content would vanish) and changes nothing
  const laxBody = await fnBody();
  let early = false;
  try { await c.query(sql("07_strict_reader_rule.sql")); early = true; } catch { await c.query("rollback"); }
  check("07 refuses to run while status-less legacy steps of PUBLISHED books are unfrozen", !early && (await fnBody()) === laxBody);

  // (2) 02b: only rule-4 legacy steps, reader output unchanged
  const before = await anonTree();
  await c.query(sql("02b_legacy_step_freeze.sql"));
  check("02b: anonymous reader tree is byte-identical before/after", (await anonTree()) === before);
  const frozen = (await c.query("select step_id from _rls02b_step_freeze_backup order by step_id")).rows.map((r) => r.step_id);
  check("02b froze exactly the status-less legacy steps of the PUBLISHED book", JSON.stringify(frozen) === JSON.stringify([S.noStatus, S.noStatus2].sort()), JSON.stringify(frozen));
  check("02b left rule-2 shaped steps ('Published' without published text) untouched", (await same(S.pubNoPm)) && (await same(S.pubNumber)));
  check("02b left the draft step, the step with published text and the DRAFT book's step untouched", (await same(S.draft)) && (await same(S.hasPm)) && (await same(S.draftBook)));
  const b2 = await content(S.noStatus);
  check("02b wrote publishedMarkdown/status for legacy steps as served before", b2.publishedMarkdown === "OLD_B" && b2.status === "Published" && b2.markdown === "OLD_B");
  check("backup table is closed to anon/authenticated", !(await c.query("select has_table_privilege('anon','public._rls02b_step_freeze_backup','SELECT') a, has_table_privilege('authenticated','public._rls02b_step_freeze_backup','SELECT') b")).rows.some((r) => r.a || r.b));

  // (2b) 07 after 02b: frozen/published content stays, 'Published' without published text is hidden, NOTICE counts them
  notices.length = 0;
  await c.query(sql("07_strict_reader_rule.sql"));
  const t07 = await anonTree();
  check("07: steps with published text (incl. frozen legacy) stay visible", t07.includes("OLD_B") && t07.includes("OLD_G") && t07.includes("PUB_D"));
  check("07: 'Published' without published text is no longer served to readers", !t07.includes("OLD_A") && !t07.includes(S.pubNumber));
  check("07 reports how many steps it hides", notices.some((n) => /07: 2 step\(s\) marked Published without published text/.test(n)), JSON.stringify(notices));
  await c.query("begin");
  await c.query(`update steps set content = '{"markdown":"UNFROZEN_LEGACY"}'::jsonb where id = $1`, [S.draft]);
  let rerun = false;
  try { await c.query("savepoint s7"); await c.query(sql("07_strict_reader_rule.sql").replace(/^BEGIN;|COMMIT;\s*$/gm, "")); rerun = true; } catch { await c.query("rollback to savepoint s7"); }
  await c.query("rollback");
  check("07 precondition also holds on a re-run (rule written out inline)", !rerun);

  // (3) edits after the freeze stay drafts: admin path (MCP-style merge) and an EDITOR under RLS (browser-style write)
  await c.query(`update steps set content = content || '{"markdown":"ADMIN_DRAFT_EDIT"}'::jsonb where id = $1`, [S.pubNoPm]);
  await c.query("begin");
  await c.query("select set_config('request.jwt.claim.sub',$1,true)", [EDITOR]);
  await c.query("set local role authenticated");
  const editorRows = (await c.query(`update steps set content = jsonb_set(content, '{markdown}', '"EDITOR_DRAFT_EDIT"') where id = $1 returning id`, [S.noStatus])).rowCount;
  await c.query("commit");
  check("an EDITOR may still save drafts under RLS", editorRows === 1);
  let t = await anonTree();
  check("new edits are NOT visible to anonymous readers; frozen text is", !t.includes("ADMIN_DRAFT_EDIT") && !t.includes("EDITOR_DRAFT_EDIT") && t.includes("OLD_B"));
  for (const f of ["03_policy_switch.sql", "04_helper_guard.sql"]) await c.query(sql(f));
  t = await anonTree();
  const editorTree = JSON.stringify((await as(EDITOR, "select reader_book_tree($1::uuid,true) t", [PUB]))[0].t);
  check("with 03/04 too: readers get published text only, the editor's draft view gets the new text", !t.includes("ADMIN_DRAFT_EDIT") && editorTree.includes("ADMIN_DRAFT_EDIT") && editorTree.includes("EDITOR_DRAFT_EDIT"));

  // (4) a second 02b run is refused and changes nothing
  let second = false;
  try { await c.query(sql("02b_legacy_step_freeze.sql")); second = true; } catch { await c.query("rollback"); /* expected: backup table exists */ }
  check("a second 02b run is refused", !second);

  // (4b) 07 rollback restores the legacy rule of 02 exactly
  await c.query(sql("07_rollback.sql"));
  check("07 rollback restores the 02 reader rule verbatim", (await fnBody()) === laxBody);

  // (5) 02b rollback: publish one frozen step first; the rollback must leave it alone and restore the other exactly
  await c.query(`update steps set content = content || '{"publishedMarkdown":"PUBLISHED_AFTER_FREEZE"}'::jsonb where id = $1`, [S.noStatus]);
  notices.length = 0;
  await c.query(sql("02b_rollback.sql"));
  const n1 = await content(S.noStatus), g1 = await content(S.noStatus2);
  check("02b rollback leaves a step published since the freeze alone", n1.publishedMarkdown === "PUBLISHED_AFTER_FREEZE" && n1.status === "Published");
  check("02b rollback restores absent keys as absent", canon(g1) === canon(ORIGINAL[S.noStatus2]));
  check("02b rollback reports restored/skipped counts", notices.some((n) => /restored 1 step\(s\), left 1/.test(n)), JSON.stringify(notices));
  check("02b rollback drops the backup table", (await c.query("select to_regclass('public._rls02b_step_freeze_backup') r")).rows[0].r === null);

  // (6) optional 02c: freezes 'Published' steps without published text (explicit decision), reversible
  await c.query(sql("02c_optional_freeze_published_without_text.sql"));
  const a6 = await content(S.pubNoPm), e6 = await content(S.pubNumber);
  check("02c freezes exactly the 'Published' steps without published text", a6.publishedMarkdown === "ADMIN_DRAFT_EDIT" && e6.publishedMarkdown === "" && (await c.query("select count(*)::int n from _rls02c_step_freeze_backup")).rows[0].n === 2);
  await c.query(sql("02c_rollback.sql"));
  const a7 = await content(S.pubNoPm), e7 = await content(S.pubNumber);
  check("02c rollback restores the original keys exactly (absent stays absent, JSON null stays null)", !("publishedMarkdown" in a7) && a7.status === "Published" && "publishedMarkdown" in e7 && e7.publishedMarkdown === null);

  // (7) 06 pins the search_path; rollback resets it
  const cfg = async () => (await c.query("select proconfig from pg_proc where proname='trigger_add_book_owner'")).rows[0].proconfig;
  check("before 06: trigger_add_book_owner has no search_path", (await cfg()) === null);
  await c.query(sql("06_pin_trigger_search_path.sql"));
  check("06 pins search_path=public, pg_temp", JSON.stringify(await cfg()) === JSON.stringify(["search_path=public, pg_temp"]));
  await c.query("insert into books(id,title,slug,created_by) values ('b0000000-0000-0000-0000-0000000000ff','x','x',$1)", [OWNER]);
  check("book creation still adds the OWNER row with 06", (await c.query("select count(*)::int n from book_members where book_id='b0000000-0000-0000-0000-0000000000ff' and role='OWNER'")).rows[0].n === 1);
  await c.query(sql("06_rollback.sql"));
  check("06 rollback resets the configuration", (await cfg()) === null);
} finally {
  await c.end();
  const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
}
const ok = checks.every(Boolean);
console.log(`RESULT: ${ok ? "PASS" : "FAIL"} (${checks.filter(Boolean).length}/${checks.length})`);
process.exit(ok ? 0 : 1);
