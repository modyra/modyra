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
 * `studio-target-react`, `studio-target-angular` and `studio-target-core` all depend on siblings as
 * `workspace:*`, and only pnpm rewrites that to a version an install accepts. All four, because a
 * property held by three of them is not a property Studio has.
 *
 * The payloads and the oracles live in `hostile-project.consumer.mjs`, which runs inside the
 * consumer. It is a file rather than a string here because the payloads are made of quotes,
 * backticks and `${`: nesting them in a template literal is how a probe ends up testing its own
 * escaping instead of the thing it was pointed at.
 *
 * This is the heaviest battle in the suite — seven packs and an install, around six seconds — and
 * the only one whose first assertion is about its own machinery. On a loaded machine that step can
 * fail, and it says so in those words: a red here is read by looking at which assertion broke
 * before it is read as a finding about a target.
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

function generateInConsumer(scriptName = "hostile-project.consumer.mjs") {
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

    writeFileSync(join(consumer, "run.mjs"), readFileSync(join(HERE, scriptName), "utf8"), "utf8");
    const stdout = execFileSync(process.execPath, [join(consumer, "run.mjs")], {
      cwd: consumer,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(stdout.trim());
    return { ran: true, ...(Array.isArray(parsed) ? { rows: parsed } : parsed) };
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

battle(
  {
    claims: ["STU-003", "STU-004"],
    title: "every target answers for a project the model calls broken",
    environments: ["node"],
  },
  async (ctx) => {
    const result = generateInConsumer("broken-project.consumer.mjs");
    ctx.log.note("every target asked about the same project", { ran: result.ran, rows: result.rows?.length ?? 0 });

    expectClaim(result.ran === true, {
      claimIds: ["STU-004"],
      what: "the targets could not be packed, installed and asked",
      detail: result.message ?? "",
    });

    const rows = result.rows ?? [];
    expectClaim(rows.length === 8, {
      claimIds: ["STU-004"],
      what: "the four shipped targets were not asked about both projects",
      detail: String(rows.length),
    });

    // The control: a project with nothing wrong is compatible everywhere and reported clean, so a
    // "yes" below is not a target that always says yes.
    const fine = rows.filter((row) => row.broken === false);
    expectEqual(fine.filter((row) => row.compatible !== true).map((row) => row.target), [], {
      claimIds: ["STU-003"],
      what: "a target refused a project with nothing wrong with it",
    });

    // `studio-model` raises SELECT_WITHOUT_OPTIONS at severity error for this project, so at least
    // one target proves the finding is reachable — without which "nobody reported it" would only
    // mean "there is nothing to report".
    const broken = rows.filter((row) => row.broken === true);
    expectClaim(broken.some((row) => row.analyzeErrors?.length > 0), {
      claimIds: ["STU-003"],
      what: "no target found the error the model raises, so the project may not be broken at all",
      detail: JSON.stringify(broken),
    });

    // And the question `analyze` exists to answer. A target that says a broken project is compatible
    // sends a host on to generate from it — which each then did, emitting both files in silence.
    const saidYes = broken.filter((row) => row.compatible === true).map((row) => row.target);
    ctx.log.note("targets that called a broken project compatible", { saidYes, broken });

    expectEqual(saidYes, [], {
      claimIds: ["STU-003", "STU-004"],
      what: "a target called a project compatible that the model reports an error for",
      detail: JSON.stringify(broken),
    });
  },
);

battle(
  {
    claims: ["STU-003"],
    title: "a field the author declared reaches the output under a name, or is reported",
    environments: ["node"],
  },
  async (ctx) => {
    // The same packed consumer, a different script: a project file with one thing missing, through
    // the door a saved project comes in by and out through a target.
    const result = generateInConsumer("a-field-nobody-named.consumer.mjs");
    ctx.log.note("a project file that is not what Studio would have written", {
      ran: result.ran,
      nameless: result.nameless?.form?.replace(/\s+/g, " ").slice(0, 80),
      refusals: result.refusals,
    });

    expectClaim(result.ran, {
      claimIds: ["STU-003"],
      what: "the packed consumer did not run, so nothing below is about Studio",
      detail: () => String(result.message ?? ""),
    });

    // The control: a well-formed field arrives under its own name with nothing reported, so a form
    // that is small is not mistaken for a field that was dropped.
    expectClaim(result.sound.door === "accepted" && result.sound.form.includes("amount:") && result.sound.loadDiagnostics === 0, {
      claimIds: ["STU-003"],
      what: "a well-formed field did not reach the output under its name",
      detail: () => JSON.stringify(result.sound),
    });

    // And the door's own refusal, used for three shapes it will not read. Without this, meeting a
    // raw TypeError below would be the only thing this door does rather than a departure.
    expectEqual(Object.values(result.refusals), ["StudioModelError", "StudioModelError", "StudioModelError"], {
      claimIds: ["STU-003"],
      what: "the door has no named refusal, so a raw type error is not a departure from anything",
    });

    // A field with no name: accepted, compiled, and emitted under the name JavaScript prints for a
    // value that is not there.
    expectClaim(!result.nameless.form?.includes("undefined"), {
      claimIds: ["STU-003"],
      what: "a field with no name was emitted as a member called `undefined`",
      detail: () => String(result.nameless.form ?? "").replace(/\s+/g, " "),
    });

    expectClaim((result.nameless.loadDiagnostics ?? 0) + (result.nameless.generateDiagnostics ?? 0) > 0, {
      claimIds: ["STU-003"],
      what: "a field with no name passed the loader and the generator without a word",
      detail: () => JSON.stringify(result.nameless),
    });

    // A kind the catalog does not declare, through the same two doors.
    expectClaim((result.strangeKind.loadDiagnostics ?? 0) + (result.strangeKind.generateDiagnostics ?? 0) > 0, {
      claimIds: ["STU-003"],
      what: "a field whose kind the catalog does not declare was carried to the output unreported",
      detail: () => JSON.stringify(result.strangeKind),
    });

    // And the two shapes the door meets with a raw type error rather than its own refusal.
    for (const what of ["noValidators", "groupNoChildren"]) {
      expectClaim(result[what].door === "accepted" || result[what].door === "StudioModelError", {
        claimIds: ["STU-003"],
        what: `${what} was met with a raw ${result[what].door} rather than the door's own refusal`,
        detail: () => String(result[what].message ?? ""),
      });
    }
  },
);
