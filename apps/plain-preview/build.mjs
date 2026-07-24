import { build } from "esbuild";
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
