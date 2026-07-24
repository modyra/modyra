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

// Own bundle (P11 Workers, plan §11): `typescript` only ever loads here,
// fetched by the browser as a separate file and instantiated via
// `new Worker(...)` — never pulled into the main studio.js entry above.
await build({
  entryPoints: [`${dir}src/codegen-worker.ts`],
  outfile: `${dir}dist/codegen-worker.js`,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  // typescript is multiple MB unminified — this is the one bundle in the
  // app where that matters enough to ask esbuild to shrink it.
  minify: true,
});
