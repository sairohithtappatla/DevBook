import { build } from "vite";
import path from "node:path";
const root = process.cwd();
await build({ root, logLevel: "error", configFile: false,
  resolve: { alias: [ { find: "@/services/db", replacement: path.join(root, "t/stub-db.ts") }, { find: "@", replacement: path.join(root, "src") } ] },
  build: { ssr: path.join(root, "t/rollback.test.ts"), outDir: path.join(root, "t/out"), emptyOutDir: true, minify: false, rollupOptions: { output: { format: "esm" } } },
  ssr: { noExternal: [/^@\//], external: ["react", "react-dom", "@tanstack/react-query"] } });
