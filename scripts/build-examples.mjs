/**
 * Builds the per-framework examples. Each example imports the @modyra/*
 * packages from node_modules — the same artifacts users install — never
 * the library sources.
 */
import { build } from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";
import sveltePlugin from "esbuild-svelte";

// Every demo ships all the packaged themes (minified CSS from the agnostic
// @modyra/styles package dist) and starts on a different one; a runtime
// switcher in each page swaps the stylesheet.
// Copied with their original filenames: the variants @import "./modyra.css"
// internally, so renaming them would break relative resolution.
// Every CSS file the package ships: the themes, the structural foundation they import, and the
// Material field the default entry keeps. A hand-kept subset silently 404s the moment the package
// grows a file, and a theme whose foundation failed to load still renders — just unstyled.
const THEME_FILES = (await import("node:fs")).readdirSync("packages/styles/dist").filter((file) => file.endsWith(".css"));
const targets = [
  { name: "react", entry: "examples/react/main.jsx" },
  { name: "vue", entry: "examples/vue/main.js" },
  { name: "lit", entry: "examples/lit/main.js" },
  // The framework-free renderer needs no transform at all — it is the plain-DOM baseline every
  // other adapter is measured against.
  // The framework-free demo is two pages: `/` is the catalogue every visual baseline is pinned to,
  // and `lab.html` is where each feature can be driven into the states that hide defects. Keeping
  // them apart is what stops a new panel from moving a screenshot of the catalogue.
  { name: "plain", entry: "examples/plain/main.js", pages: ["examples/plain/lab.js"] },
  // Preact's automatic JSX runtime is esbuild's react transform pointed at
  // a different import source — no Babel plugin needed.
  { name: "preact", entry: "examples/preact/main.jsx", jsxImportSource: "preact" },
  // Solid's JSX compiles to fine-grained DOM ops at build time — a
  // different transform than esbuild's own `jsx: "automatic"`, so it goes
  // through `esbuild-plugin-solid` (wraps babel-preset-solid) instead of
  // esbuild's native JSX handling. Small, targeted addition to this one
  // build call rather than switching the whole example pipeline to Vite.
  { name: "solid", entry: "examples/solid/main.jsx", plugins: [solidPlugin()] },
  // Svelte components compile to imperative DOM ops at build time too —
  // same reasoning as Solid above, through `esbuild-svelte` instead of
  // `esbuild-plugin-solid`.
  { name: "svelte", entry: "examples/svelte/main.js", plugins: [sveltePlugin()] },
];
for (const { name, entry, jsxImportSource, plugins, pages = [] } of targets) {
  await build({
    entryPoints: [entry, ...pages],
    bundle: true,
    ...(plugins ? {} : { jsx: "automatic", ...(jsxImportSource ? { jsxImportSource } : {}) }),
    ...(plugins ? { plugins } : {}),
    format: "esm",
    ...(pages.length ? { outdir: `dist/examples/${name}` } : { outfile: `dist/examples/${name}/main.js` }),
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      // vue: runtime template compiler build
      vue: "vue/dist/vue.esm-bundler.js",
      // `@modyra/plain` and `@modyra/styles` are private workspace packages, so they are resolved
      // from their build output rather than through node_modules — no dependency is added for a demo.
      "@modyra/plain": "./packages/plain/dist/index.js",
      "@modyra/styles": "./packages/styles/dist/index.js",
    },
    logLevel: "error",
  });
  const { copyFileSync, mkdirSync, readdirSync } = await import("node:fs");
  mkdirSync(`dist/examples/${name}`, { recursive: true });
  // Every page the example ships, not just the entry one.
  for (const page of readdirSync(`examples/${name}`).filter((f) => f.endsWith(".html"))) {
    copyFileSync(`examples/${name}/${page}`, `dist/examples/${name}/${page}`);
  }
  mkdirSync(`dist/examples/${name}/themes`, { recursive: true });
  for (const file of THEME_FILES) {
    copyFileSync(`packages/styles/dist/${file}`, `dist/examples/${name}/themes/${file}`);
  }
  console.log(`examples/${name} → dist/examples/${name} (${THEME_FILES.length} themes${pages.length ? `, ${pages.length + 1} pages` : ""})`);
}
