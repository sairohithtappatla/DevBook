// Bundles editor-save.test.ts with the real src/ of the project (or a scratch copy) and the in-memory steps stub.
//   cd <repo or scratch copy> ; cp -r mcp/proposals/rls-hardening/frontend-tests t   (or point T_DIR at the folder)
//   node t/build-editor.mjs && node t/out-editor/editor-save.test.js
import { build } from "vite";
import path from "node:path";
const root = process.cwd();
const t = process.env.T_DIR ? path.resolve(process.env.T_DIR) : path.join(root, "t");
await build({ root, logLevel: "error", configFile: false,
  resolve: { alias: [ { find: "@/lib/insforge", replacement: path.join(t, "stub-steps-db.ts") }, { find: "@", replacement: path.join(root, "src") } ] },
  build: { ssr: path.join(t, "editor-save.test.ts"), outDir: path.join(t, "out-editor"), emptyOutDir: true, minify: false, rollupOptions: { output: { format: "esm" } } },
  ssr: { noExternal: [/^@\//] } });
