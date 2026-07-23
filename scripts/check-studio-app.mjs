/**
 * Runs automatically before site's `dev`/`build` (npm's `pre<script>`
 * convention — see site/package.json) so a missing sync step fails loud
 * with a clear fix, not a silent 404 on /studio's JS/CSS discovered later
 * in a browser. Same "reach into root scripts/ with a plain Node script,
 * no workspace install needed" pattern as sync-docs-site.mjs.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const marker = join(root, "site/public/studio-app/studio.js");

if (!existsSync(marker)) {
  console.warn(
    "\n[studio] site/public/studio-app/ is missing — /studio will 404 on its JS/CSS.\n" +
      "Run `npm run sync:studio-app` from the repo root first (builds the full\n" +
      "Studio stack via the pnpm workspace, then copies the bundle in here).\n",
  );
}
