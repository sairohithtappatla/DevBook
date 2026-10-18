// Bundles reader-integration.test.ts (SSR) with the real src/ of the scratch project and the stub client.
//   cp -r frontend-tests/* <scratch>/t/ ; cd <scratch> ; node t/build-reader.mjs [reader-page] && node t/out/<entry>.js
import { build } from "vite";
import path from "node:path";
const root = process.cwd();
const entry = process.argv[2] === "reader-page" ? "t/reader-page.test.tsx" : "t/reader-integration.test.ts";
await build({ root, logLevel: "error", configFile: false,
  resolve: { alias: [ { find: "@/lib/insforge", replacement: path.join(root, "t/stub-insforge.ts") }, { find: "@", replacement: path.join(root, "src") } ] },
  build: { ssr: path.join(root, entry), outDir: path.join(root, process.argv[2] === "reader-page" ? "t/out-page" : "t/out"), emptyOutDir: true, minify: false, rollupOptions: { output: { format: "esm" } } },
  ssr: { noExternal: [/^@\//], external: ["react", "react-dom", "@tanstack/react-query"] } });
