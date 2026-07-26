/**
 * Ensures the Astro site has the standalone Studio assets it references.
 *
 * site/public/studio-app is generated and intentionally not committed. A fresh
 * checkout therefore needs to build and copy Studio before Astro starts. The
 * docs deployment performs that step explicitly; local `site` commands use
 * this script so they cannot start with a page that points at missing files.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "site/public/studio-app");
const required = [
  "studio.js",
  "studio.css",
  "codegen-worker.js",
];

function missingAssets() {
  return required.filter((name) => !existsSync(join(destination, name)));
}

let missing = missingAssets();
if (missing.length === 0) {
  console.log(`[studio-assets] ready: ${destination}`);
  process.exit(0);
}

console.log(`[studio-assets] missing ${missing.join(", ")}; building Studio...`);
try {
  execFileSync(
    process.execPath,
    [join(root, "scripts/prepare-studio-app.mjs")],
    { cwd: root, stdio: "inherit" },
  );
} catch (error) {
  console.error(
    "\n[studio-assets] Could not prepare Studio for the documentation site.\n" +
      "Run `corepack pnpm install --frozen-lockfile` from the repository root,\n" +
      "then retry the site command.\n",
  );
  process.exit(typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 1);
}

missing = missingAssets();
if (missing.length > 0) {
  console.error(`[studio-assets] build completed but these files are still missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`[studio-assets] ready: ${destination}`);
