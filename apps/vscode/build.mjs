import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Resolved relative to this file, not the caller's CWD, so the build works from the repo root and
// from within this package alike.
const dir = fileURLToPath(new URL(".", import.meta.url));

/**
 * The extension host loads CommonJS, and this package and everything it reads — `@modyra/widgets`,
 * `jsonc-parser` — are ESM. Bundling settles both: one CommonJS file with its dependencies inlined,
 * so the extension does not depend on how the host resolves modules.
 *
 * `vscode` stays external. It is not a package on disk; the host injects it.
 */
await build({
  entryPoints: [`${dir}src/extension.ts`],
  outfile: `${dir}dist/extension.cjs`,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  external: ["vscode"],
  // Prefer each dependency's ES module build. `jsonc-parser` also ships a UMD bundle whose
  // `require("./impl/format")` is computed at call time; taking that one leaves a relative require
  // in the output that resolves against `dist/`, where nothing lives, and the extension fails on the
  // first document it formats rather than at load.
  mainFields: ["module", "main"],
});
