/**
 * Builds the per-framework examples. Each example imports the @modyra/*
 * packages from node_modules — the same artifacts users install — never
 * the library sources.
 */
import { build } from "/Users/lorenzo.local/projects/test/ngx-signal-forms/node_modules/.pnpm/esbuild@0.27.4/node_modules/esbuild/lib/main.js";

// Every demo ships all the packaged themes (plain CSS from the built
// @modyra/angular package) and starts on a different one; a runtime
// switcher in each page swaps the stylesheet.
const THEMES = {
  default: "modyra.css",
  material: "modyra-material.css",
  ios: "modyra-ios.css",
  ionic: "modyra-ionic.css",
  base: "modyra-base.css",
};
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
  for (const [alias, file] of Object.entries(THEMES)) {
    copyFileSync(`packages/angular/dist/styles/${file}`, `dist/examples/${name}/themes/${alias}.css`);
  }
  console.log(`examples/${name} → dist/examples/${name} (${Object.keys(THEMES).length} themes)`);
}
