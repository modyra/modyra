import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));

await build({
  entryPoints: [`${dir}src/main.ts`],
  outfile: `${dir}dist/plain-preview.js`,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
});


// Keep styling as a static asset. The application module does not import CSS.
const themeFiles = [
  "../../packages/styles/dist/modyra-base.css",
  "../../packages/styles/dist/modyra.css",
  "../../packages/styles/dist/modyra-modern.css",
];
const theme = themeFiles
  .map((file) => readFileSync(`${dir}${file}`, "utf8").replace(/@import\s+[^;]+;/g, ""))
  .join("\n");
mkdirSync(`${dir}dist`, { recursive: true });
writeFileSync(`${dir}dist/plain-preview.css`, theme);
