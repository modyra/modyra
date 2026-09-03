/**
 * Which package directories a release publishes, read from the workspace rather than listed.
 *
 * A hand-written roster stops covering what ships the moment a package is added, and the check
 * built on it goes on passing over the ones it still knows — which is how the tarball audit came to
 * cover two of thirteen, and how the type-surface snapshot came to watch three while eleven
 * published packages had no release gate looking at their exported types at all.
 *
 * The membership question has one answer and several askers, so it lives here. `packages/angular`
 * is private in source and published from its build output, which is why "not private" alone is the
 * wrong predicate: applied literally it drops the one package that needed a special path.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Directory names under `packages/` that a release publishes, sorted. */
export function publishedPackageDirs() {
  return readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const manifest = JSON.parse(
          readFileSync(join(ROOT, "packages", entry.name, "package.json"), "utf8"),
        );
        if (manifest.private === true && entry.name !== "angular") return [];
        return [entry.name];
      } catch {
        return [];
      }
    })
    .sort();
}
