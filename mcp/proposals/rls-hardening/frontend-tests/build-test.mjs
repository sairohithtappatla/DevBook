// Generic SSR bundler for the frontend tests: node t/build-test.mjs <entry file in t/> <out dir in t/>
//   e.g. node t/build-test.mjs softdelete.test.ts out-sd && node t/out-sd/softdelete.test.js
import { build } from "vite";
import path from "node:path";
const root = process.cwd();
const [entry, out] = process.argv.slice(2);
await build({ root, logLevel: "error", configFile: false,
  resolve: { alias: [ { find: "@/lib/insforge", replacement: path.join(root, "t/stub-insforge.ts") }, { find: "@", replacement: path.join(root, "src") } ] },
  build: { ssr: path.join(root, "t", entry), outDir: path.join(root, "t", out), emptyOutDir: true, minify: false, rollupOptions: { output: { format: "esm" } } },
  ssr: { noExternal: [/^@\//], external: ["react", "react-dom", "@tanstack/react-query"] } });
