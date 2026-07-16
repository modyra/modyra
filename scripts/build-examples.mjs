/**
 * Builds the per-framework examples. Each example imports the @modyra/*
 * packages from node_modules — the same artifacts users install — never
 * the library sources.
 */
import { build } from "/Users/lorenzo.local/projects/test/ngx-signal-forms/node_modules/.pnpm/esbuild@0.27.4/node_modules/esbuild/lib/main.js";

// Each demo showcases one of the shipped themes (plain CSS from the
// packaged @modyra/angular build — framework-agnostic class-based styles).
const targets = [
  { name: "react", entry: "examples/react/main.jsx", theme: "modyra-material.css" },
  { name: "vue", entry: "examples/vue/main.js", theme: "modyra-ios.css" },
  { name: "lit", entry: "examples/lit/main.js", theme: "modyra.css" },
];
for (const { name, entry, theme } of targets) {
  await build({
    entryPoints: [entry],
    bundle: true,
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
  copyFileSync(`packages/angular/dist/styles/${theme}`, `dist/examples/${name}/theme.css`);
  console.log(`examples/${name} → dist/examples/${name} (theme: ${theme})`);
}
