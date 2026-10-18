import handler from "./handler.ts";

const URL_ = "https://probe.test/hello-mcp";
const MCP_HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };

function post(body: unknown, headers: Record<string, string> = MCP_HEADERS): Promise<Response> {
  return handler(new Request(URL_, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

Deno.test("initialize negotiates protocol and advertises tools", async () => {
  const res = await post(init);
  const json = await res.json();
  assert(res.status === 200, `status ${res.status}`);
  assert(json.result.protocolVersion === "2025-06-18", "protocolVersion");
  assert(json.result.capabilities.tools, "tools capability");
  assert(res.headers.get("mcp-session-id") === null, "stateless: no session id");
});

Deno.test("tools/list exposes echo with a bounded string schema", async () => {
  const json = await (await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
  const echo = json.result.tools.find((t: { name: string }) => t.name === "echo");
  assert(echo, "echo listed");
  assert(echo.inputSchema.properties.text.maxLength === 200, "maxLength 200");
  assert(echo.annotations.readOnlyHint === true, "readOnlyHint");
});

Deno.test("tools/call echo returns the text", async () => {
  const json = await (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { text: "hi" } } })).json();
  assert(json.result.content[0].text === "hi", "echo text");
  assert(!json.result.isError, "no error");
});

Deno.test("tools/call with invalid input returns isError, not a crash", async () => {
  for (const args of [{ text: 5 }, {}, { text: "" }, { text: "x".repeat(201) }]) {
    const res = await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: args } });
    const json = await res.json();
    assert(res.status === 200, "HTTP 200 with tool error");
    assert(json.result.isError === true, `isError for ${JSON.stringify(args).slice(0, 30)}`);
  }
});

Deno.test("unknown tool and unknown method produce JSON-RPC errors", async () => {
  const t = await (await post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } })).json();
  assert(t.error || t.result?.isError, "unknown tool rejected");
  const m = await (await post({ jsonrpc: "2.0", id: 6, method: "does/not/exist" })).json();
  assert(m.error?.code === -32601, `method not found, got ${JSON.stringify(m)}`);
});

Deno.test("non-POST methods return 405 with Allow: POST", async () => {
  for (const method of ["GET", "DELETE", "PUT", "PATCH"]) {
    const res = await handler(new Request(URL_, { method, headers: { accept: "text/event-stream" } }));
    assert(res.status === 405, `${method} -> ${res.status}`);
    assert(res.headers.get("allow") === "POST", `${method} Allow header`);
    await res.text();
  }
});

Deno.test("malformed JSON -> 400 parse error; wrong content-type -> 415; oversize -> 413", async () => {
  const bad = await post("{not json");
  assert(bad.status === 400 && (await bad.json()).error.code === -32700, "400 -32700");
  const ct = await post(init, { "content-type": "text/plain", accept: MCP_HEADERS.accept });
  assert(ct.status === 415, `415, got ${ct.status}`);
  await ct.text();
  const big = await post({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "echo", arguments: { text: "x".repeat(20000) } } });
  assert(big.status === 413, `413, got ${big.status}`);
  await big.text();
});

Deno.test("browser Origin is rejected with 403", async () => {
  const res = await post(init, { ...MCP_HEADERS, origin: "https://evil.example" });
  assert(res.status === 403, `403, got ${res.status}`);
  await res.text();
});

Deno.test("missing Accept header is rejected by the transport", async () => {
  const res = await post(init, { "content-type": "application/json" });
  assert(res.status === 406, `406, got ${res.status}`);
  await res.text();
});

Deno.test("responses are independent across calls (no shared state)", async () => {
  const [a, b] = await Promise.all([
    post({ jsonrpc: "2.0", id: "a", method: "tools/call", params: { name: "echo", arguments: { text: "A" } } }),
    post({ jsonrpc: "2.0", id: "b", method: "tools/call", params: { name: "echo", arguments: { text: "B" } } }),
  ]);
  const [ja, jb] = [await a.json(), await b.json()];
  assert(ja.id === "a" && ja.result.content[0].text === "A", "A isolated");
  assert(jb.id === "b" && jb.result.content[0].text === "B", "B isolated");
});

Deno.test("notification (no id) is accepted with 202 and empty body", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert(res.status === 202, `202, got ${res.status}`);
  assert((await res.text()) === "", "empty body");
});

Deno.test("chunked body without Content-Length is capped (413)", async () => {
  const chunk = new TextEncoder().encode("x".repeat(4096));
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= 8) return controller.close();
      sent++;
      controller.enqueue(chunk);
    },
  });
  const res = await handler(new Request(URL_, { method: "POST", headers: MCP_HEADERS, body, duplex: "half" } as RequestInit));
  assert(res.status === 413, `413, got ${res.status}`);
  assert(sent < 8, `stopped reading early (sent ${sent})`);
  await res.text();
});

Deno.test("empty body and invalid UTF-8 -> 400 parse error", async () => {
  const empty = await post("");
  assert(empty.status === 400, `empty -> ${empty.status}`);
  await empty.text();
  const bad = await handler(new Request(URL_, { method: "POST", headers: MCP_HEADERS, body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) }));
  assert(bad.status === 400, `invalid utf8 -> ${bad.status}`);
  await bad.text();
});

Deno.test("HEAD and OPTIONS are 405", async () => {
  for (const method of ["HEAD", "OPTIONS"]) {
    const res = await handler(new Request(URL_, { method }));
    assert(res.status === 405, `${method} -> ${res.status}`);
    await res.text();
  }
});

Deno.test("handler source has no env, DB, or InsForge dependencies", async () => {
  const raw = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));
  // Scan code only; comments may legitimately mention the platform by name.
  const src = raw.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const banned of ["Deno.env", "insforge", "createClient", "createAdminClient", "fetch(", "Deno.readFile", "Deno.writeFile"]) {
    assert(!src.toLowerCase().includes(banned.toLowerCase()), `handler.ts must not contain ${banned}`);
  }
});
