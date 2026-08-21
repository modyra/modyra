/**
 * The newest modification time under a directory tree.
 *
 * A build is stale when its output is older than its input, and the only honest way to ask that is to
 * walk both trees. Asking a *directory's* own mtime instead is the trap this module exists to close:
 * a directory's mtime records when an entry was last added or removed from it, not when the files
 * beneath it were last written, so a rebuild that overwrites files in place leaves it untouched and a
 * fresh build reads as stale.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The newest mtime in milliseconds among files under `directory` matching one of `extensions`,
 * recursively. Returns 0 when the directory does not exist or holds nothing that matches — an
 * absence, which a caller must distinguish from "old" rather than compare as a timestamp.
 */
export function newestUnder(directory, extensions) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestUnder(path, extensions));
      continue;
    }
    if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}
