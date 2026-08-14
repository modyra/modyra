/**
 * A pattern a document chose, run on every keystroke.
 *
 * The Dynamic Form Contract exists so a form can arrive as data from somewhere that is not the
 * application: a CMS, a model, a saved project, a POST. `validators.pattern` is a string in that
 * data, and `buildDynamicValidators` compiles it into a `RegExp` the engine runs on every write.
 *
 * The engine already treats that string as needing care — an invalid source is skipped with a
 * diagnostic rather than thrown — so the question is not whether patterns are checked but what they
 * are checked *for*. Syntax is checked. Cost is not.
 *
 * `(a+)+$` is a valid regular expression and one of the oldest known catastrophic ones. Against a
 * thirty-character input it takes over twelve seconds here, and the growth is exponential: each
 * extra character roughly quadruples it. That is a single field, in a browser, between two
 * keystrokes.
 *
 * The battle runs it in a child process under a time budget rather than in the suite. An engine that
 * bounds this answers instantly; one that does not would otherwise hang the run it is part of, and a
 * battle that has to be killed is a battle nobody keeps.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** Valid regular expressions whose cost explodes on input that does not match. */
const CATASTROPHIC = Object.freeze(["(a+)+$", "^(a|a)*$", "^(a*)*$"]);

/** An input a person could type into a field without trying to break anything. */
const TYPED = `${"a".repeat(30)}!`;

/** How long one field's validation may take before a form has stopped answering. */
const BUDGET_MS = 1000;

/**
 * Compile a pattern the way a document does and validate one value, in a child process.
 *
 * The child is what makes the budget enforceable: a pattern that does not terminate cannot be
 * measured from inside the process it is hanging.
 */
function validateUnderBudget(pattern, input) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-pattern-"));
  const script = join(dir, "run.mjs");
  writeFileSync(
    script,
    [
      `import { buildDynamicValidators } from "@modyra/core";`,
      `const { validators } = buildDynamicValidators({ pattern: ${JSON.stringify(pattern)} });`,
      `const started = process.hrtime.bigint();`,
      `for (const validate of validators) validate(${JSON.stringify(input)});`,
      `console.log(String(Number(process.hrtime.bigint() - started) / 1e6));`,
    ].join("\n"),
    "utf8",
  );

  try {
    const stdout = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: BUDGET_MS,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { answered: true, ms: Math.round(Number(stdout.trim())) };
  } catch (error) {
    // A timeout is the finding, not an error in the battle: the child was killed because the
    // pattern was still running.
    return { answered: false, killed: error.killed === true, signal: error.signal ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["SEC-004"],
    title: "a pattern from a document answers about one field in a reasonable time",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary pattern, through the same machinery, so a failure below is about the
    // pattern rather than about the child process or the budget being unreachable.
    const ordinary = validateUnderBudget("^a+$", TYPED);
    ctx.log.note("an ordinary pattern from a document", ordinary);

    expectClaim(ordinary.answered && ordinary.ms < 100, {
      claimIds: ["SEC-004"],
      what: "an ordinary pattern did not answer promptly, so the budget measures the wrong thing",
      detail: JSON.stringify(ordinary),
    });

    // And a pattern that is not valid at all is already refused rather than thrown — the engine
    // treats this string as needing care, which is what makes the omission below an omission
    // rather than an absence.
    const malformed = validateUnderBudget("[", TYPED);
    expectClaim(malformed.answered, {
      claimIds: ["SEC-004"],
      what: "an unparseable pattern was not handled",
      detail: JSON.stringify(malformed),
    });

    for (const pattern of CATASTROPHIC) {
      const outcome = validateUnderBudget(pattern, TYPED);
      ctx.log.note("a catastrophic pattern from a document", { pattern, outcome });

      expectClaim(outcome.answered && outcome.ms < BUDGET_MS, {
        claimIds: ["SEC-004"],
        what: `a document's pattern ${JSON.stringify(pattern)} took a field's validation past ${BUDGET_MS}ms`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);
