// Reads stdin, masks common secret shapes, writes stdout. Cross-platform replacement for sed pipelines.
//   <command> 2>&1 | node mcp/tools/redact.mjs     (works in bash and PowerShell)
//   node mcp/tools/redact.mjs some-file.sql
// Best effort: always skim the result yourself before pasting it anywhere.
const rules = [
  [/\b(ik_|uak_|dbk_|sk-|sk_live_|sk_test_)[A-Za-z0-9._-]{6,}/g, "$1[REDACTED]"],
  [/eyJ[A-Za-z0-9._-]{20,}/g, "[JWT-REDACTED]"],
  [/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[REDACTED]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]"],
  [/((?:password|passwd|secret|token|api[_-]?key|anon[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[REDACTED]"],
];
import { readFileSync } from "node:fs";

const mask = (text) => rules.reduce((s, [re, rep]) => s.replace(re, rep), text);

// `node redact.mjs file.sql` masks a file; with no argument it filters stdin.
if (process.argv[2]) {
  process.stdout.write(mask(readFileSync(process.argv[2], "utf8")));
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => process.stdout.write(mask(input)));
}
