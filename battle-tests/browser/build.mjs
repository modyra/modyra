#!/usr/bin/env node
/**
 * Bundles the host page a browser battle attacks.
 *
 * A browser cannot resolve bare specifiers, so the host is bundled — through the same published
 * entry points every other battle uses, which is what keeps this a consumer build rather than a
 * privileged one. Output is disposable and git-ignored.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { build } from "esbuild";

const BATTLE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = resolve(BATTLE_ROOT, "..");
const OUT_DIR = join(BATTLE_ROOT, ".tmp-browser");

mkdirSync(OUT_DIR, { recursive: true });

// The stylesheet, without which the host renders structure and no geometry.
//
// A popup's decided width, its placement above or below its anchor, a column's span and whether a
// control is shown are all carried as `--mdy-overlay-*` and `--mdy-layout-*` custom properties, and
// nothing turns them into a rendered box except these rules. A page without them answers every
// geometric question with the same answer — unpositioned, `display: block` — which is an answer that
// cannot fail, and a spec that asks one is measuring nothing.
//
// `default.css` is what `@modyra/styles` ships as its default and the layer the catalog's own class
// names key on. The themes — material, ios, ionic — change geometry, so a tier that loaded one of
// them would be measuring that theme rather than the contract every adapter shares.
//
// Copied from the package's build output for the same reason the Plain bundle is: the file a
// consumer loads through the `@modyra/styles/default.css` subpath.
copyFileSync(
  join(REPO_ROOT, "packages", "styles", "dist", "modyra-default.css"),
  join(OUT_DIR, "modyra.css"),
);

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

// A second host, rendered by `@modyra/lit`. Separate page and separate bundle so the Plain host is
// untouched: a spec that drives one must not be able to disturb the other.
await build({
  entryPoints: [join(BATTLE_ROOT, "browser", "host", "lit-entry.mjs")],
  outfile: join(OUT_DIR, "lit-host.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  // `@modyra/lit` is a root dependency, so its published subpaths resolve as a consumer's would —
  // no alias, which is what keeps this a consumer build.
  logLevel: "warning",
});

// A third host, rendered by `@modyra/angular`. Until this existed the tier had two renderers of
// three, and every question about Angular's rendered geometry — paint order, pointer behaviour, what
// a dial actually draws — could only be answered by reading its source.
//
// `@modyra/angular` is a private workspace package, so it resolves from its build output the way the
// demos are built; the host's source keeps the specifier a consumer would write. Angular itself
// resolves as a root dependency.
await build({
  entryPoints: [join(BATTLE_ROOT, "browser", "host", "angular-entry.mjs")],
  outfile: join(OUT_DIR, "angular-host.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  alias: {
    "@modyra/angular/ui": join(REPO_ROOT, "packages", "angular", "dist", "fesm2022", "modyra-angular-ui.mjs"),
    "@modyra/angular": join(REPO_ROOT, "packages", "angular", "dist", "fesm2022", "modyra-angular.mjs"),
  },
  logLevel: "warning",
});

writeFileSync(
  join(OUT_DIR, "angular.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Modyra battle host (angular)</title>
    <link rel="stylesheet" href="./modyra.css" />
  </head>
  <body>
    <main id="stage"></main>
    <script type="module" src="./angular-host.js"></script>
  </body>
</html>
`,
  "utf8",
);

writeFileSync(
  join(OUT_DIR, "lit.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Modyra battle host (lit)</title>
    <link rel="stylesheet" href="./modyra.css" />
  </head>
  <body>
    <main id="stage"></main>
    <script type="module" src="./lit-host.js"></script>
  </body>
</html>
`,
  "utf8",
);

writeFileSync(
  join(OUT_DIR, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Modyra battle host</title>
    <link rel="stylesheet" href="./modyra.css" />
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
