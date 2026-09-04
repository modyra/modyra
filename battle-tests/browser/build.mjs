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
// Where the host is written, and which package it is built from.
//
// Both are overridable so a host can be built from a copy of a package carrying a planted defect,
// into a directory of its own. A mutated host written over the shared one would be picked up by any
// run started beside it, and its greens would be about a bundle nobody in that run built.
const OUT_DIR = process.env.MDY_HOST_OUT ?? join(BATTLE_ROOT, ".tmp-browser");
/**
 * `@modyra/<name>=<path to a copy of that package's build>`, applied to every bundle in this build.
 *
 * The value is the directory: a subpath import is remapped by appending to it, so an alias pointing
 * at a file resolves `@modyra/core/datetime` inside `index.js` and the build stops.
 */
const [MUTANT_PKG, MUTANT_ENTRY] = (process.env.MDY_HOST_ALIAS ?? "=").split("=");
const withMutant = (alias) => (MUTANT_ENTRY === "" ? alias : { ...alias, [MUTANT_PKG]: MUTANT_ENTRY });
// A copy lives outside the workspace, so its own `@modyra/*` neighbours do not resolve from where it
// sits. They are looked up in the root's links, which is where a consumer's would be found.
const NODE_PATHS = MUTANT_ENTRY === "" ? undefined : [join(REPO_ROOT, "node_modules")];

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

// The other four, beside the default rather than instead of it.
//
// `@modyra/styles` ships five sheets and this tier loaded one, so four of them were never rendered
// anywhere a measurement could reach — a theme could stop styling a control and every check would stay
// green, because the only thing that reads a theme is a person looking at it. Copying them costs one
// `copyFileSync` each and lets a spec ask what a control looks like under the theme a team actually
// ships.
//
// Not linked from the host pages: a page loading two themes is measuring their cascade rather than
// either of them. A spec swaps the sheet at runtime through `<link>`, so the page it measures is the
// page a consumer would have.
for (const theme of ["modern", "material", "ios", "ionic"]) {
  copyFileSync(
    join(REPO_ROOT, "packages", "styles", "dist", `modyra-${theme}.css`),
    join(OUT_DIR, `modyra-${theme}.css`),
  );
}

await build({
  entryPoints: [join(BATTLE_ROOT, "browser", "host", "entry.mjs")],
  outfile: join(OUT_DIR, "host.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  // `@modyra/plain` is a private workspace package with no root dependency, so it resolves from its
  // build output — the same alias the demos are built with. The host's source keeps the specifier a
  // consumer would write.
  nodePaths: NODE_PATHS,
  alias: withMutant({ "@modyra/plain": join(REPO_ROOT, "packages", "plain", "dist", "index.js") }),
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
  // nothing is aliased here, which is what keeps this a consumer build.
  nodePaths: NODE_PATHS,
  alias: withMutant({}),
  logLevel: "warning",
});

// A fourth host, rendered by `@modyra/vue`. It is the first renderer in this tier that draws a kind
// with a component and a prop rather than a registered element per kind, so it is what tells the
// suite which of its questions were about the contract and which were about custom elements.
//
// `@modyra/vue` and `vue` are both root dependencies, so nothing is aliased: this is a consumer build.
await build({
  entryPoints: [join(BATTLE_ROOT, "browser", "host", "vue-entry.mjs")],
  outfile: join(OUT_DIR, "vue-host.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  nodePaths: NODE_PATHS,
  alias: withMutant({}),
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
  nodePaths: NODE_PATHS,
  alias: withMutant({
    "@modyra/angular/ui": join(REPO_ROOT, "packages", "angular", "dist", "fesm2022", "modyra-angular-ui.mjs"),
    "@modyra/angular": join(REPO_ROOT, "packages", "angular", "dist", "fesm2022", "modyra-angular.mjs"),
  }),
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
  join(OUT_DIR, "vue.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Modyra battle host (vue)</title>
    <link rel="stylesheet" href="./modyra.css" />
  </head>
  <body>
    <main id="stage"></main>
    <script type="module" src="./vue-host.js"></script>
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
