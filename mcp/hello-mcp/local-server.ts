// Local-only shim to exercise handler.ts with curl/verify.mjs. Not deployed.
import handler from "./handler.ts";

Deno.serve({ port: Number(Deno.env.get("PORT") ?? "8787"), hostname: "127.0.0.1" }, handler);
