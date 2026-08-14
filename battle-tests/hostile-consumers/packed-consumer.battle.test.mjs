/**
 * The same behaviour, from a tarball a stranger installed.
 *
 * Everything else in this suite reaches `@modyra/core` through a workspace link. A consumer does
 * not: they get whatever `npm pack` put in the archive, resolved by an installer that reads the
 * exports map rather than a symlink. The two differ whenever a file is missing from `files`, an
 * export is declared for a path that was never built, or a condition resolves elsewhere.
 *
 * `scripts/audit-published-tarballs.mjs` already asks whether every declared entry point *resolves*
 * from an installed tarball. It does not ask whether the package then *behaves* the same, which is
 * what `PKG-001` promises and what this checks: one fixed script, run twice, compared byte for byte.
 *
 * The other half of `PKG-001` — that a consumer never resolves two copies of a package — is the
 * subject of ADR 0033 and is guarded by `npm run test:tarballs`, which installs the whole published
 * set together. Repeating it here would mean fetching peer dependencies from the network, and a
 * battle that fails when a registry is slow is a battle nobody trusts.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(HERE, "shared", "behaviour-script.mjs");

/**
 * Run the behaviour script and hand back only what it printed to stdout.
 *
 * `stderr` is deliberately dropped: the script provokes a diagnostic on purpose, and a warning is
 * not part of what the two installs have to agree about. What they must agree about is the JSON.
 */
function behaviourFrom(cwd) {
  return execFileSync(process.execPath, [join(cwd, "behaviour-script.mjs")], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

battle(
  {
    claims: ["PKG-001"],
    title: "a consumer installing the tarball sees what the workspace sees",
    environments: ["node"],
  },
  async (ctx) => {
    const work = mkdtempSync(join(tmpdir(), "mdy-packed-"));

    try {
      // The workspace half. Resolution walks upward, so the script has to run from a directory
      // inside the repository for the link to be found — a temporary directory elsewhere would
      // resolve nothing and the comparison would be between two failures.
      const inRepo = join(REPO, "battle-tests", ".packed-workspace");
      mkdirSync(inRepo, { recursive: true });
      copyFileSync(SCRIPT, join(inRepo, "behaviour-script.mjs"));
      const workspaceOutput = behaviourFrom(inRepo);
      rmSync(inRepo, { recursive: true, force: true });
      ctx.log.note("behaviour recorded against the workspace", { bytes: workspaceOutput.length });

      // The control before the comparison: two empty outputs agree perfectly. The script has to have
      // produced the observations it exists to produce.
      expectClaim(workspaceOutput.length > 500 && workspaceOutput.includes("afterRename"), {
        claimIds: ["PKG-001"],
        what: "the behaviour script produced observations to compare",
        detail: `${workspaceOutput.length} byte(s)`,
      });

      // The packed half: an archive built the way a release builds it, installed by npm into a
      // project that has never seen this repository.
      execFileSync("npm", ["pack", "--pack-destination", work, "--silent"], {
        cwd: join(REPO, "packages", "core"),
        stdio: ["ignore", "ignore", "pipe"],
      });
      const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
      expectClaim(tarball !== undefined, {
        claimIds: ["PKG-001"],
        what: "npm pack produced a tarball to install",
        detail: JSON.stringify(readdirSync(work)),
      });

      const consumer = join(work, "consumer");
      mkdirSync(consumer, { recursive: true });
      writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
      execFileSync("npm", ["install", join(work, tarball), "--silent", "--no-audit", "--no-fund"], {
        cwd: consumer,
        stdio: ["ignore", "ignore", "pipe"],
      });
      copyFileSync(SCRIPT, join(consumer, "behaviour-script.mjs"));

      // One copy, which is the structural half of the promise: a second would mean two engines, and
      // a handle from one is not a handle to the other.
      const installed = readdirSync(join(consumer, "node_modules", "@modyra"));
      expectEqual(installed, ["core"], {
        claimIds: ["PKG-001"],
        what: "the consumer resolved exactly one copy of the engine",
      });

      const packedOutput = behaviourFrom(consumer);
      ctx.log.note("behaviour recorded against the packed install", { bytes: packedOutput.length });

      expectEqual(packedOutput, workspaceOutput, {
        claimIds: ["PKG-001"],
        what: "the packed package behaved differently from the workspace one",
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
      rmSync(join(REPO, "battle-tests", ".packed-workspace"), { recursive: true, force: true });
    }
  },
);
