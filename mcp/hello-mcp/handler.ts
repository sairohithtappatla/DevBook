// Isolated runtime probe for DevBook MCP. No database, no secrets, no InsForge client.
// Purpose: prove the official MCP SDK + stateless Streamable HTTP run on InsForge Edge Functions.
// Shape follows the official InsForge functions docs: `export default async function (req: Request): Promise<Response>`
// with static `npm:` imports.
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.32.1/server/webStandardStreamableHttp.js";
import { z } from "npm:zod@3.25.76";

const MAX_BODY_BYTES = 16 * 1024;
// Browsers send Origin; MCP clients that call us server-to-server do not. Empty = reject every browser origin.
const ALLOWED_ORIGINS: string[] = [];

const BASE_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function jsonRpcError(status: number, code: number, message: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { ...BASE_HEADERS, ...extra },
  });
}

// Fresh server + transport per request: stateless, nothing shared between callers.
function buildServer(): McpServer {
  const server = new McpServer({ name: "devbook-hello-mcp", version: "0.0.2" });
  server.registerTool(
    "echo",
    {
      title: "Echo",
      description: "Returns the given text unchanged. Harmless runtime probe; reads and writes nothing.",
      inputSchema: { text: z.string().min(1).max(200) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ text }: { text: string }) => ({ content: [{ type: "text" as const, text }] }),
  );
  return server;
}

async function readLimited(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      // Stateless server: no standalone SSE stream (GET) and no session to terminate (DELETE).
      return jsonRpcError(405, -32000, "Method not allowed. Use POST.", { allow: "POST" });
    }

    const origin = req.headers.get("origin");
    if (origin !== null && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonRpcError(403, -32000, "Origin not allowed.");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonRpcError(415, -32000, "Content-Type must be application/json.");
    }

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      return jsonRpcError(413, -32000, "Request body too large.");
    }
    // Stream with a hard cap so chunked bodies without Content-Length cannot be buffered unbounded.
    const bytes = await readLimited(req, MAX_BODY_BYTES);
    if (bytes === null) {
      return jsonRpcError(413, -32000, "Request body too large.");
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return jsonRpcError(400, -32700, "Parse error: body is not valid UTF-8 JSON.");
    }

    const server = buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody });
    // Fresh per-request instances; close so nothing lingers after the response.
    queueMicrotask(() => {
      void server.close().catch(() => {});
    });
    return response;
  } catch (err) {
    // Never return stack traces or internals.
    console.error("[hello-mcp] unhandled error", err instanceof Error ? err.name : "unknown");
    return jsonRpcError(500, -32603, "Internal error.");
  }
}
