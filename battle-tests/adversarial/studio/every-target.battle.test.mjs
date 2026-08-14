/**
 * The same hostile project through every target Studio ships.
 *
 * A Studio project is authored data — names, labels, descriptions, initial values — and a target
 * turns it into files somebody compiles. `generated-identifiers` already attacks the codegen
 * primitive that does the turning; this attacks the three targets that ship, because a property that
 * holds in a primitive and not in one of its callers is not a property a consumer has.
 *
 * The targets are packed with `pnpm pack` and installed into a temporary consumer, so what is
 * measured is the published tarball rather than the workspace: `studio-target-json`,
 * `studio-target-react` and `studio-target-angular` all depend on siblings as `workspace:*`, and
 * only pnpm rewrites that to a version an install accepts.
 *
 * The payloads and the oracles live in `hostile-project.consumer.mjs`, which runs inside the
 * consumer. It is a file rather than a string here because the payloads are made of quotes,
 * backticks and `${`: nesting them in a template literal is how a probe ends up testing its own
 * escaping instead of the thing it was pointed at.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** Every package the three targets need to stand up on their own. */
const PACKAGES = Object.freeze([
  "studio-model",
  "studio-contract",
  "studio-codegen",
  "studio-target-core",
  "studio-target-json",
  "studio-target-react",
  "studio-target-angular",
]);

function generateInConsumer() {
  const work = mkdtempSync(join(tmpdir(), "mdy-targets-"));
  try {
    for (const pkg of PACKAGES) {
      execFileSync("pnpm", ["pack", "--pack-destination", work], {
        cwd: join(REPO, "packages", pkg),
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const tarballs = readdirSync(work)
      .filter((name) => name.endsWith(".tgz"))
      .map((name) => join(work, name));

    const consumer = join(work, "consumer");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "c", private: true, type: "module" })}\n`);
    execFileSync("npm", ["install", ...tarballs, "--silent", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: ["ignore", "ignore", "pipe"],
    });

    writeFileSync(join(consumer, "run.mjs"), readFileSync(join(HERE, "hostile-project.consumer.mjs"), "utf8"), "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "run.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ran: true, ...JSON.parse(stdout.trim()) };
  } catch (error) {
    return { ran: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 3).join(" ") };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["STU-001", "SEC-001"],
    title: "a value an author typed does not become code in any target that ships",
    environments: ["node"],
  },
  async (ctx) => {
    const result = generateInConsumer();
    ctx.log.note("generated from packed tarballs", {
      ran: result.ran,
      files: result.rows?.length ?? 0,
      identifiers: Object.keys(result.declarable ?? {}).length,
    });

    expectClaim(result.ran === true, {
      claimIds: ["STU-001"],
      what: "the three targets could not be packed, installed and run",
      detail: result.message ?? "",
    });

    // A run that generated nothing would pass every assertion below, so the count is asserted first
    // and against what the payload table says it must be: six payloads across three targets.
    expectClaim((result.rows?.length ?? 0) >= 18, {
      claimIds: ["STU-001"],
      what: "the run emitted fewer files than the payload table asks for",
      detail: String(result.rows?.length ?? 0),
    });

    // The oracle's own control. Two harmless generations of one project are byte-identical; if they
    // are not, every comparison this battle makes is measuring something else.
    const unstable = (result.selfCheck ?? []).filter((each) => each.stable === false);
    expectEqual(unstable, [], {
      claimIds: ["STU-001"],
      what: "generating the same project twice produced different files, so nothing here is comparable",
    });

    // A payload that closed the literal it was written into leaves a module that no longer parses.
    const broke = (result.rows ?? [])
      .filter((row) => row.parsesClean === true && row.parsesHostile === false)
      .map((row) => `${row.payload} → ${row.target}/${row.path}`);
    expectEqual(broke, [], {
      claimIds: ["STU-001", "SEC-001"],
      what: "a value from a project stopped an emitted module from parsing, which is a value that became syntax",
    });

    // A contract that still reads back the exact string is one where the value stayed data.
    const lost = (result.rows ?? [])
      .filter((row) => row.jsonReadsBack === false)
      .map((row) => `${row.payload} → ${row.target}/${row.path}`);
    expectEqual(lost, [], {
      claimIds: ["STU-001"],
      what: "a JSON artefact did not read back the value that was authored, so it was mangled or escaped into something else",
    });

    // And every name derived from an authored string is a name the language accepts.
    const notNames = Object.entries(result.declarable ?? {})
      .filter(([, ok]) => ok === false)
      .map(([name]) => name);
    expectEqual(notNames, [], {
      claimIds: ["STU-001"],
      what: "a target derived an identifier the language will not accept",
    });

    expectClaim(Object.keys(result.declarable ?? {}).length > 0, {
      claimIds: ["STU-001"],
      what: "no target emitted an identifier at all, so the check above examined nothing",
    });
  },
);
