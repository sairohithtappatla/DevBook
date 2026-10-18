// node --test mcp-token.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const run = (...a) => spawnSync(process.execPath, [new URL("./mcp-token.mjs", import.meta.url).pathname, ...a], { encoding: "utf8" });

test("stdout carries only the hash; stderr carries the token once; hash matches", () => {
  const r = run("--email", "me@example.com", "--label", "claude code", "--scopes", "read,draft");
  assert.equal(r.status, 0, r.stderr);
  const token = /(dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43})/.exec(r.stderr)?.[1];
  assert.ok(token); assert.ok(!r.stdout.includes(token) && !r.stdout.includes("dbk_"));
  const hash = /'([0-9a-f]{64})'/.exec(r.stdout)[1];
  assert.equal(hash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.equal(token.slice(4, 12), /'([A-Za-z0-9_-]{8})', '[0-9a-f]{64}'/.exec(r.stdout)[1]);
  assert.equal(r.stderr.split(token).length - 1, 1, "token printed exactly once");
});
test("two runs give different tokens", () => {
  const t = () => /(dbk_[^\s]+)/.exec(run("--email", "me@example.com", "--label", "x").stderr)[1];
  assert.notEqual(t(), t());
});
test("hostile arguments are rejected before any SQL is produced", () => {
  for (const bad of [["--email", "a@b.com'; drop table x;--", "--label", "x"], ["--email", "me@example.com", "--label", "x'); --"], ["--email", "me@example.com", "--label", "x", "--scopes", "read,admin"], ["--email", "me@example.com", "--label", "x", "--days", "9999"], ["--label", "x"], ["--revoke-prefix", "a'b"]]) {
    const r = run(...bad); assert.equal(r.status, 2, bad.join(" ")); assert.equal(r.stdout, "");
  }
});
test("revoke SQL", () => {
  const r = run("--revoke-prefix", "AbCdEf12"); assert.equal(r.status, 0);
  assert.match(r.stdout, /where token_prefix = 'AbCdEf12'/);
});
test("generated SQL is valid PostgreSQL (parser only)", async () => {
  let q; try { q = createRequire("/tmp/claude-0/-home-user-DevBook/fcccd09d-dfcf-5576-8649-6f89614bd0b1/scratchpad/pgparse/x.js")("libpg-query"); } catch { return; } // optional dependency
  await q.loadModule();
  const r = run("--email", "me@example.com", "--label", "claude code", "--scopes", "read,draft,publish");
  assert.ok(q.parseSync(r.stdout).stmts.length === 1);
});
