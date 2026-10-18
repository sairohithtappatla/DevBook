// Produces fixtures/reader-fixtures.json from the REAL SQL objects (01-04 + the trimmed 02) running on a disposable
// native PostgreSQL. The frontend tests replay these outputs, so the data contract is taken from the function itself,
// not from assumptions. Sandbox only; nothing here can reach InsForge.
//   PGHOST/PGPORT/PGUSER + PG_MODULE=/abs/node_modules  SQL_DIR=<folder with 01..04 where 02 has the grant trim applied>
//   node generate-fixtures.mjs
// SAFETY: these scripts CREATE and DROP databases. They only run against a local disposable PostgreSQL.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST) || (process.env.PGHOST === undefined && process.env.PGHOSTADDR)) {
  console.error("Refusing: PGHOST must be 127.0.0.1/localhost (a disposable local PostgreSQL), never a shared or production database.");
  process.exit(2);
}
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rls = path.resolve(here, "..");
const sqlDir = process.env.SQL_DIR ?? rls;
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const rd = (f) => fs.readFileSync(f, "utf8");
const U = { owner: 1, editor: 2, reviewer: 3, viewer: 4, stranger: 5 };
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const B = { PUB: "b0000000-0000-0000-0000-000000000001", EMPTY: "b0000000-0000-0000-0000-000000000002", UNL: "b0000000-0000-0000-0000-000000000003", DRAFTBOOK: "b0000000-0000-0000-0000-000000000004" };
const P = { A: "f0000000-0000-0000-0000-00000000000a", B: "f0000000-0000-0000-0000-00000000000b", C: "f0000000-0000-0000-0000-00000000000c", D: "f0000000-0000-0000-0000-00000000000d", E: "f0000000-0000-0000-0000-00000000000e", U: "f0000000-0000-0000-0000-00000000000f", X: "f0000000-0000-0000-0000-000000000010" };
const S = (n) => `50000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

const name = "fx_" + Math.random().toString(36).slice(2, 8);
const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
const c = new pg.Client({ database: name }); await c.connect();
await c.query(rd(path.join(rls, "sandbox/schema.sql")));
for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]) await c.query(rd(path.join(sqlDir, f)));
for (const [k, n] of Object.entries(U)) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(n), `${k}@x.invalid`]); await c.query("insert into users(id,name,avatar_url,bio) values ($1,$2,$3,$4)", [uid(n), `Author ${k}`, `https://img.invalid/${k}.png`, `bio of ${k}`]); }
const book = (id, title, slug, status, access) => c.query("insert into books(id,title,slug,description,publication_status,access_level,created_by,tags) values ($1,$2,$3,$4,$5,$6,$7,$8)", [id, title, slug, `${title} description`, status, access, uid(1), ["tagA", "tagB"]]);
await book(B.PUB, "Public Book", "public-book", "PUBLISHED", "PUBLIC");
await book(B.EMPTY, "Empty Book", "empty-book", "PUBLISHED", "PUBLIC");
await book(B.UNL, "Unlisted Book", "unlisted-book", "PUBLISHED", "UNLISTED");
await book(B.DRAFTBOOK, "Draft Book", "draft-book", "DRAFT", "PUBLIC");
for (const [who, role] of [["editor", "EDITOR"], ["reviewer", "REVIEWER"], ["viewer", "VIEWER"]]) await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,$3)", [B.PUB, uid(U[who]), role]);
const phase = (id, bid, title, pos) => c.query("insert into phases(id,book_id,title,position) values ($1,$2,$3,$4)", [id, bid, title, pos]);
await phase(P.A, B.PUB, "Phase A", 1); await phase(P.B, B.PUB, "Phase B", 2); await phase(P.C, B.PUB, "Phase C (no steps)", 3); await phase(P.D, B.PUB, "Phase D (draft only)", 4);
await phase(P.E, B.EMPTY, "Only phase", 1); await phase(P.U, B.UNL, "Unlisted phase", 1); await phase(P.X, B.DRAFTBOOK, "Draft phase", 1);
const step = (n, ph, title, pos, content) => c.query("insert into steps(id,phase_id,title,position,content) values ($1,$2,$3,$4,$5::jsonb)", [S(n), ph, title, pos, JSON.stringify(content)]);
await step(1, P.A, "Published step", 1, { slug: "published-step", status: "Published", markdown: "DRAFT-EDIT-1 newer unpublished text", publishedMarkdown: "PUB-1 published text", description: "d1", difficulty: "Intermediate", estimatedTime: 7, visibility: "Public" });
await step(2, P.A, "Draft-only step", 2, { slug: "draft-only", status: "Draft", markdown: "DRAFT_SECRET only an editor may read", description: "d2" });
await step(3, P.B, "Legacy step", 1, { markdown: "LEGACY text of a step without status" });
await step(4, P.D, "Draft in phase D", 1, { status: "Draft", markdown: "DRAFT_SECRET phase D" });
await step(5, P.U, "Unlisted step", 1, { slug: "unl", status: "Published", markdown: "UNL text", publishedMarkdown: "UNL text" });
await step(6, P.X, "Step of a draft book", 1, { status: "Published", markdown: "DRAFT_SECRET book", publishedMarkdown: "DRAFT_SECRET book" });
await c.query("insert into attachments(id,step_id,file_name,storage_path,file_type,file_size) values ($1,$2,'pub.pdf','k/pub.pdf','application/pdf',10),($3,$4,'draft.pdf','k/draft.pdf','application/pdf',20)", ["a0000000-0000-0000-0000-000000000001", S(1), "a0000000-0000-0000-0000-000000000002", S(2)]);

const ACTORS = { anon: null, stranger: U.stranger, viewer: U.viewer, reviewer: U.reviewer, editor: U.editor, owner: U.owner };
async function asActor(name, fn) {
  await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [ACTORS[name] ? uid(ACTORS[name]) : ""]);
  await c.query(ACTORS[name] ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await c.query("reset role"); }
}
const out = { generatedFrom: "native PostgreSQL " + (await c.query("show server_version")).rows[0].server_version, ids: { books: B, phases: P, steps: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, S(n)])), users: Object.fromEntries(Object.entries(U).map(([k, n]) => [k, uid(n)])) }, trees: {}, counts: {}, embed: {}, raw: {} };
out.raw.phases = (await c.query("select id, book_id, title, position from phases order by position")).rows;
out.raw.steps = (await c.query("select id, phase_id, title, position, content from steps order by position")).rows;
for (const actor of Object.keys(ACTORS)) {
  out.trees[actor] = {};
  await asActor(actor, async () => {
    for (const [bk, id] of Object.entries(B)) for (const drafts of [false, true]) {
      out.trees[actor][`${bk}:${drafts}`] = (await c.query("select public.reader_book_tree($1::uuid,$2::boolean) as t", [id, drafts])).rows[0].t;
    }
    out.counts[actor] = (await c.query("select book_id, step_count from reader_book_step_counts order by book_id")).rows;
    // what the old `phases?select=book_id,steps(id)` embed returns under RLS for this actor
    out.embed[actor] = (await c.query("select p.book_id, coalesce((select json_agg(json_build_object('id', s.id)) from steps s where s.phase_id = p.id), '[]'::json) as steps from phases p order by p.position")).rows;
  });
}
await c.end();
const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
fs.writeFileSync(path.join(here, "fixtures/reader-fixtures.json"), JSON.stringify(out, null, 1));
console.log("wrote fixtures/reader-fixtures.json;", Object.keys(out.trees).length, "actors");
