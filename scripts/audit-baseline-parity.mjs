/**
 * Every screenshot baseline exists for both platforms, or the suite says which one is missing.
 *
 * Playwright names baselines per platform (`<shot>-darwin.png`, `<shot>-linux.png`) and compares
 * only against the current platform's file. A shot recorded on one platform and never on the other
 * is invisible locally and fails only on the other platform's runner — as a "snapshot doesn't
 * exist" error that carries no diff to read. This audit turns that late, unreadable failure into an
 * immediate named one.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const E2E = join(ROOT, "e2e");
const PLATFORMS = ["darwin", "linux"];

function* snapshotDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (entry.name.endsWith("-snapshots")) yield path;
    else yield* snapshotDirs(path);
  }
}

const missing = [];
for (const dir of snapshotDirs(E2E)) {
  const names = new Set(readdirSync(dir).filter((n) => n.endsWith(".png")));
  for (const name of names) {
    const match = name.match(/^(.*)-(darwin|linux)\.png$/);
    if (!match) continue;
    for (const platform of PLATFORMS) {
      const sibling = `${match[1]}-${platform}.png`;
      if (!names.has(sibling)) missing.push(join(relative(ROOT, dir), sibling));
    }
  }
}

if (missing.length > 0) {
  console.error("BASELINE PARITY: missing platform siblings\n");
  for (const path of [...new Set(missing)].sort()) console.error(`  ${path}`);
  console.error(
    "\nRecord them on the missing platform (Visual baselines workflow for linux, a local run for darwin).",
  );
  process.exit(1);
}
console.log("BASELINE PARITY CLEAN — every screenshot exists for darwin and linux.");
