/**
 * Run a series of checks and say, for each, whether the tree held still while it ran.
 *
 * On a shared tree another session is writing while a suite runs, and a suite cannot tell. The
 * failure that matters is not the loud one — a half-written file breaks the build and is obvious.
 * It is the quiet one: an edit that compiles lands mid-run, every check passes, and the green is
 * reported for a tree that existed at no point in the history. Nothing in the output says so, and
 * whoever reads it has only their memory of when the peer was typing.
 *
 * So each part is bracketed: the head and the working tree are fingerprinted before and after, and
 * a part whose fingerprint changed is reported **UNTRUSTED — neither passed nor failed**. That
 * distinction is the whole point. A contaminated run that says "failed" invites a hunt for a defect
 * that may not exist; one that says "passed" is worse. Only "I cannot tell you" is true.
 *
 * It does not ask anyone to stop typing. On a shared tree movement is the normal condition, and it
 * is the instrument's job to see it rather than the peers' job to take turns.
 *
 * **What it cannot see, said out loud.** The fingerprint is built from git, so a change to a file
 * git ignores is invisible to it — a built `dist`, a generated host bundle, anything under an
 * ignored path. A check that compiles from those can still be measuring something that moved while
 * reporting a still tree. The freshness guard in the browser host covers one such case by comparing
 * build times; the rest are uncovered, and a green here means "the tracked tree held still", never
 * "nothing the check read changed".
 *
 * Usage:
 *   node scripts/still-tree-shot.mjs battle:ci battle:browser:ci test:angular test:contracts
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * What the tree is right now: the head plus every tracked change, hashed.
 *
 * `git status --porcelain` rather than a timestamp: a file written and written back is the same
 * tree, and a run across it was never contaminated. What matters is whether the bytes a check
 * compiled could have changed under it, not whether an editor touched them.
 */
function fingerprint() {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  // The diff of the dirty files too: `status` alone says a file is modified, not what it now says,
  // and two different edits to one file look identical to it.
  const diff = execFileSync("git", ["diff"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return createHash("sha256").update(`${head}\n${dirty}\n${diff}`).digest("hex").slice(0, 12);
}

const parts = process.argv.slice(2);
if (parts.length === 0) {
  console.error("Name the checks to run, e.g. battle:ci battle:browser:ci test:angular test:contracts");
  process.exit(2);
}

const rows = [];
for (const part of parts) {
  const before = fingerprint();
  const started = Date.now();
  const run = spawnSync("npm", ["run", part], { cwd: ROOT, stdio: "inherit" });
  const after = fingerprint();
  rows.push({
    part,
    rc: run.status,
    still: before === after,
    before,
    after,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}

console.log("\n# Shot\n");
for (const row of rows) {
  const verdict = !row.still
    ? "UNTRUSTED — the tree moved while this ran"
    : row.rc === 0 ? "passed" : `failed (rc=${row.rc})`;
  console.log(`  ${row.part.padEnd(22)} ${String(row.seconds).padStart(4)}s  ${verdict}`);
  if (!row.still) console.log(`  ${" ".padEnd(22)}       ${row.before} → ${row.after}`);
}

const moved = rows.filter((row) => !row.still);
const failed = rows.filter((row) => row.still && row.rc !== 0);

if (moved.length > 0) {
  console.log(`\n${moved.length} part(s) ran across a moving tree and tell you nothing — `
    + "re-run them when it is still. A contaminated pass is not a pass.");
}
if (failed.length === 0 && moved.length === 0) console.log("\nAll parts passed on a still tree.");

// A moved part is not a failure, but it is not a green either: the caller asked whether this head is
// good and the honest answer is that it was not measured.
process.exit(moved.length > 0 || failed.length > 0 ? 1 : 0);
