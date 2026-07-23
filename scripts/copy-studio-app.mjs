/**
 * P12: copies apps/studio's built bundle into site/public/studio-app/ so
 * the Astro docs site (which installs/builds in isolation via its own
 * site/package-lock.json, never touching the pnpm workspace) can serve
 * Studio as a plain static asset instead of needing Vite to resolve
 * @modyra/studio-ui from source at site-build time.
 *
 * Run after `npm run build:studio` (root), before `npm run build --prefix
 * site`. Source is gitignored build output; destination is too — this
 * script is the only thing that populates it, in CI or locally.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "apps/studio/dist");
const destination = join(root, "site/public/studio-app");

if (!existsSync(source)) {
  console.error(`[copy-studio-app] ${source} does not exist — run "npm run build:studio" first.`);
  process.exit(1);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
console.log(`[copy-studio-app] copied ${source} -> ${destination}`);
