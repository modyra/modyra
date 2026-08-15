/**
 * The lists Studio lets an author build, and the forms they turn into.
 *
 * Studio is where a person assembles a form, so it is where being told costs least. Its compiler
 * already inspects an option list: a select with no options is refused with `SELECT_WITHOUT_OPTIONS`
 * and `UNCOMPILABLE_FIELD`, and the field does not reach the document.
 *
 * Two other lists reach it and produce forms that are wrong in ways a person cannot see:
 *
 *   - **Two options sharing a value.** Their generated ids collide, so the rendered list is short one
 *     option and it is the first one the author wrote. `browser/an-option-that-never-appears.spec.ts`
 *     is that consequence.
 *   - **A value containing a space.** The option's id contains it too, and `aria-activedescendant`
 *     splits on whitespace, so the reference names nothing. `browser/an-option-with-a-space-in-it.spec.ts`
 *     is that one.
 *
 * The compiler is asked here rather than the parser because the parser sees a document somebody
 * already wrote. Studio is where it is still an editing session.
 *
 * The Studio packages are packed and installed into a temporary consumer, so what is measured is the
 * published tarball: they depend on each other as `workspace:*` and only `pnpm pack` rewrites that to
 * something an install accepts. The first assertion is about that machinery, so a red is read by
 * looking at which assertion broke before it is read as a finding.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** What the compiler needs to stand up on its own. */
const PACKAGES = Object.freeze(["studio-model", "studio-contract"]);

function compileInConsumer(scriptName = "option-lists.consumer.mjs") {
  const work = mkdtempSync(join(tmpdir(), "mdy-options-"));
  try {
    for (const pkg of PACKAGES) {
      execFileSync("pnpm", ["pack", "--pack-destination", work], {
        cwd: join(REPO, "packages", pkg),
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const tarballs = readdirSync(work).filter((name) => name.endsWith(".tgz")).map((name) => join(work, name));

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
    return { ran: true, rows: JSON.parse(stdout.trim()) };
  } catch (error) {
    return { ran: false, message: `${error.stderr ?? error.message}`.split("\n").slice(0, 3).join(" ") };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["STU-002", "DYN-003", "A11Y-002"],
    title: "an option list Studio compiles is one every option survives",
    environments: ["node"],
  },
  async (ctx) => {
    const outcome = compileInConsumer();
    ctx.log.note("what the packed compiler made of each list", outcome);

    // The machinery first: two packs and an install. On a loaded machine this is what fails, and it
    // says so here rather than being read as a finding about option lists.
    expectClaim(outcome.ran, {
      claimIds: ["STU-002"],
      what: "the Studio packages could not be packed, installed and run — this is about the machinery, not about a list",
      detail: outcome.message ?? "",
    });

    const rowFor = (what) => outcome.rows.find((row) => row.what === what);

    // The control: a clean list compiles quietly and carries every value.
    const clean = rowFor("distinct values");
    expectEqual([clean.diagnostics, clean.carried], [[], ["a", "b", "c"]], {
      claimIds: ["STU-002"],
      what: "a list of distinct options did not compile cleanly, so nothing below is comparable",
      detail: JSON.stringify(clean),
    });

    // The precedent: the compiler already looks at this list and already refuses one shape of it.
    const empty = rowFor("no options");
    expectClaim(empty.diagnostics.includes("SELECT_WITHOUT_OPTIONS"), {
      claimIds: ["STU-002"],
      what: "an option field with no options is not reported, so the compiler does not inspect this list at all",
      detail: JSON.stringify(empty),
    });

    // And the two that build a broken form.
    for (const [what, why] of [
      ["two sharing a value", "their generated ids collide, so the rendered list is short one option"],
      ["a value with a space", "the option's id carries the space, and an ARIA reference splits on it"],
    ]) {
      const row = rowFor(what);
      ctx.log.note("a list that compiles and should not", { what, ...row });

      expectClaim(row.diagnostics.length > 0, {
        claimIds: ["STU-002", "DYN-003", "A11Y-002"],
        what: `Studio compiles ${what} without a word — ${why}`,
        detail: JSON.stringify(row),
      });
    }
  },
);
