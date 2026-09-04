/**
 * Every published type is one a consumer can import — asked of a build that is current.
 *
 * `battle-tests/types/every-published-type-is-importable.ts` names each published type in a type
 * position, and `tsc` answers by resolving each one through the package's built declarations. So the
 * check is only ever about the `dist/` that is on disk, and nothing in the suite that runs it builds
 * one.
 *
 * That is not theoretical. Three names were reported here as reachable from no entry point, with a
 * precise `TS2305` for each — read from a build made while they were briefly un-exported. A compile
 * error is convincing in a way a silence is not, and it was answering about a tree that no longer
 * existed.
 *
 * So the freshness question is asked first, in the same words the surface audit asks it, and the
 * type check runs only once it has an answer worth having.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { publishedPackageDirs } from "./lib/published-packages.mjs";
import { refuseStaleBuilds } from "./lib/built-artifacts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

refuseStaleBuilds(publishedPackageDirs(), {
  root: ROOT,
  reads: "the declarations a consumer would import",
});

const run = spawnSync(
  "npx",
  ["tsc", "--noEmit", "-p", "battle-tests/types/tsconfig.json"],
  { cwd: ROOT, stdio: "inherit" },
);
process.exit(run.status ?? 1);
