// Black-box check of a hello-mcp endpoint. Node 18+, any OS. Sends only POST/GET/etc. probes to the
// URL you pass; reads and writes nothing else. Prints status + trimmed body, never request headers.
//   node mcp/hello-mcp/verify.mjs https://<host>/hello-mcp
// If the platform demands a bearer (unknown until tested), set HELLO_MCP_BEARER in your shell; it is
// sent as `Authorization: Bearer ...` and never printed.
const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error("usage: node verify.mjs <endpoint-url>");
  process.exit(2);
}
const bearer = process.env.HELLO_MCP_BEARER;
const MCP = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const rpc = (id, method, params) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const has = (s) => (body) => body.includes(s);

const cases = [
  ["1 initialize", "POST", MCP, rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } }), 200, has('"protocolVersion"')],
  ["2 tools/list", "POST", MCP, rpc(2, "tools/list"), 200, has('"echo"')],
  ["3 echo ok", "POST", MCP, rpc(3, "tools/call", { name: "echo", arguments: { text: "hello" } }), 200, has('"text":"hello"')],
  ["4 echo bad type", "POST", MCP, rpc(4, "tools/call", { name: "echo", arguments: { text: 5 } }), 200, has('"isError":true')],
  ["5 unknown method", "POST", MCP, rpc(5, "nope/nope"), 200, has("-32601")],
  ["6 malformed JSON", "POST", MCP, "{not json", 400, has("-32700")],
  ["7 wrong content-type", "POST", { "content-type": "text/plain", accept: MCP.accept }, "x", 415, has("Content-Type")],
  ["8 GET", "GET", { accept: "text/event-stream" }, undefined, 405, null],
  ["9 DELETE", "DELETE", {}, undefined, 405, null],
  ["10 PUT", "PUT", MCP, "{}", 405, null],
  ["11 browser Origin", "POST", { ...MCP, origin: "https://evil.example" }, rpc(11, "tools/list"), 403, null],
  ["12 notification", "POST", MCP, JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), 202, null],
  ["13 oversize body", "POST", MCP, rpc(13, "tools/call", { name: "echo", arguments: { text: "x".repeat(20000) } }), 413, null],
];

let ok = 0;
let platformGate = 0;
for (const [label, method, headers, body, wantStatus, bodyCheck] of cases) {
  const h = { ...headers, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
  let status = 0, ct = "", text = "";
  try {
    const res = await fetch(url, { method, headers: h, body, signal: AbortSignal.timeout(30000) });
    status = res.status;
    ct = res.headers.get("content-type") ?? "";
    text = await res.text();
  } catch (e) {
    text = `fetch failed: ${e instanceof Error ? e.message : "unknown"}`;
  }
  const isJsonRpc = text.includes('"jsonrpc"');
  if ((status === 401 || status === 403) && !isJsonRpc && wantStatus !== status) platformGate++;
  const pass = status === wantStatus && (!bodyCheck || bodyCheck(text));
  if (pass) ok++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  want=${wantStatus} got=${status}  ct=${ct}`);
  if (!pass) console.log(`      body: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
}
console.log(`\n${ok}/${cases.length} matched expectations.`);
if (platformGate > 0) {
  console.log("Note: some 401/403 responses are not JSON-RPC, so the platform (not our handler) rejected them. Authentication is required in front of the function; see README.");
}
process.exit(ok === cases.length ? 0 : 1);
