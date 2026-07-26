/** Copies canonical brand assets into the Astro public directory. */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "brand");
const destination = join(root, "site/public/brand");

if (!existsSync(source)) {
  console.error(`[sync-brand-assets] missing source directory: ${source}`);
  process.exit(1);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const directory of ["01-logo", "02-color", "03-typography", "04-icons", "05-social", "06-favicon"]) {
  cpSync(join(source, directory), join(destination, directory), { recursive: true });
}

const required = [
  "01-logo/svg/modyra-logo-horizontal.svg",
  "01-logo/svg/modyra-logo-horizontal-light.svg",
  "02-color/modyra-tokens.css",
  "03-typography/fonts/Satoshi-Regular.woff2",
  "04-icons/mdy-core.svg",
  "05-social/og-image.png",
  "06-favicon/favicon.svg",
];
const missing = required.filter((path) => !existsSync(join(destination, path)));
if (missing.length > 0) {
  console.error(`[sync-brand-assets] incomplete copy: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`[sync-brand-assets] copied ${source} -> ${destination}`);
