/**
 * Builds the per-framework examples. Each example imports the @modyra/*
 * packages from node_modules — the same artifacts users install — never
 * the library sources.
 */
import { build } from "esbuild";

// Every demo ships all the packaged themes (minified CSS from the agnostic
// @modyra/styles package dist) and starts on a different one; a runtime
// switcher in each page swaps the stylesheet.
// Copied with their original filenames: the variants @import "./modyra.css"
// internally, so renaming them would break relative resolution.
const THEME_FILES = [
  "modyra.css",
  "modyra-material.css",
  "modyra-ios.css",
  "modyra-ionic.css",
  "modyra-base.css",
];
const targets = [
  { name: "react", entry: "examples/react/main.jsx" },
  { name: "vue", entry: "examples/vue/main.js" },
  { name: "lit", entry: "examples/lit/main.js" },
];
for (const { name, entry } of targets) {
  await build({
    entryPoints: [entry],
    bundle: true,
    jsx: "automatic",
    format: "esm",
    outfile: `dist/examples/${name}/main.js`,
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    // vue: runtime template compiler build
    alias: { vue: "vue/dist/vue.esm-bundler.js" },
    logLevel: "error",
  });
  const { copyFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(`dist/examples/${name}`, { recursive: true });
  copyFileSync(`examples/${name}/index.html`, `dist/examples/${name}/index.html`);
  mkdirSync(`dist/examples/${name}/themes`, { recursive: true });
  for (const file of THEME_FILES) {
    copyFileSync(`packages/styles/dist/${file}`, `dist/examples/${name}/themes/${file}`);
  }
  console.log(`examples/${name} → dist/examples/${name} (${THEME_FILES.length} themes)`);
}
