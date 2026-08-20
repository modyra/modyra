/**
 * The Angular builder requires asset/style paths to live inside the
 * workspace root (this directory). The theme CSS is built at the repo root
 * (packages/styles/dist), so copy it next to the app before build/serve —
 * the runtime theme switcher fetches /styles/*.css from there.
 *
 * It also refuses to start on a library build older than the library's source. See
 * {@link assertTheLibraryIsBuilt}.
 */
import { cpSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** The newest mtime under a directory, or 0 when it does not exist. */
function newestUnder(directory, extensions) {
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

/**
 * Refuses to serve a library build older than the library's source.
 *
 * `node_modules/@modyra/angular` is a symlink to `packages/angular/dist`, and `ng serve` watches this
 * app's sources — not the `ng-packagr` output the symlink points at. So a change made to the library
 * while the server is running is invisible until someone reruns `build:angular`, and the page keeps
 * answering with the code from whenever that last happened.
 *
 * That is indistinguishable, from the browser, from the change not working. It has cost real hours:
 * a defect was repaired, the repair was measured green in the workspace, and the app went on showing
 * the old behaviour to someone who reasonably concluded the repair had failed.
 *
 * It stops rather than rebuilding. A rebuild hidden inside a `prestart` puts a slow step behind a
 * command that looks fast, and someone who means to serve the current build can still do it by
 * running the build themselves.
 */
function assertTheLibraryIsBuilt() {
  const root = fileURLToPath(new URL("../../packages/angular/", import.meta.url));
  const sourceAt = newestUnder(join(root, "src"), [".ts", ".html", ".scss", ".css"]);
  const builtAt = newestUnder(join(root, "dist"), [".mjs", ".js", ".d.ts"]);

  // No source and no build is not this script's business to judge — a fresh clone has neither, and
  // the Angular builder will say so far more clearly than a heuristic here could.
  if (sourceAt === 0 || builtAt === 0) return;
  if (builtAt >= sourceAt) return;

  const behind = Math.round((sourceAt - builtAt) / 1000);
  const howLong = behind < 90 ? `${behind}s` : `${Math.round(behind / 60)}m`;
  console.error(
    `\n[example] @modyra/angular's build is ${howLong} behind its source.\n` +
      `          node_modules/@modyra/angular points at packages/angular/dist, and ng serve does\n` +
      `          not rebuild it — so this app would answer with the older code.\n\n` +
      `          Run:  pnpm run build:angular\n` +
      `          Or:   npm run demo:angular      (builds, then serves)\n`,
  );
  process.exit(1);
}

assertTheLibraryIsBuilt();

const from = new URL("../../packages/styles/dist", import.meta.url);
const to = new URL("./.styles", import.meta.url);

rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log("styles copied → examples/angular/.styles");
