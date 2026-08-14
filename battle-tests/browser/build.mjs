#!/usr/bin/env node
/**
 * Bundles the host page a browser battle attacks.
 *
 * A browser cannot resolve bare specifiers, so the host is bundled — through the same published
 * entry points every other battle uses, which is what keeps this a consumer build rather than a
 * privileged one. Output is disposable and git-ignored.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { build } from "esbuild";

const BATTLE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = resolve(BATTLE_ROOT, "..");
const OUT_DIR = join(BATTLE_ROOT, ".tmp-browser");

mkdirSync(OUT_DIR, { recursive: true });

await build({
  entryPoints: [join(BATTLE_ROOT, "browser", "host", "entry.mjs")],
  outfile: join(OUT_DIR, "host.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  // `@modyra/plain` is a private workspace package with no root dependency, so it resolves from its
  // build output — the same alias the demos are built with. The host's source keeps the specifier a
  // consumer would write.
  alias: { "@modyra/plain": join(REPO_ROOT, "packages", "plain", "dist", "index.js") },
  logLevel: "warning",
});

writeFileSync(
  join(OUT_DIR, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Modyra battle host</title>
  </head>
  <body>
    <main id="stage"></main>
    <script type="module" src="./host.js"></script>
  </body>
</html>
`,
  "utf8",
);

console.log(`battle host built → ${OUT_DIR}`);
