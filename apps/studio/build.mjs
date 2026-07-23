import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Resolved relative to this file, not the caller's CWD, so `npm run build`
// works both from the repo root (root's `build:studio`) and from within
// this package (`npm --prefix apps/studio run build`).
const dir = fileURLToPath(new URL(".", import.meta.url));

await build({
  entryPoints: [`${dir}src/main.ts`],
  outfile: `${dir}dist/studio.js`,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  loader: {
    ".css": "css",
    ".woff2": "file",
  },
});
