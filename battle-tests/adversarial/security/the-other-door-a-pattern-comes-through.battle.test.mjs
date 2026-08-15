/**
 * The second place a document hands the engine a regular expression.
 *
 * `validators.pattern` is the door already watched: a document supplies a string, the engine compiles
 * it, and a catastrophic one would run between two keystrokes. `matches` is the other door. It takes
 * a literal pattern inside an expression, and expressions are what a document's `validations` and
 * `rules` are made of — the same untrusted origin, a different route in.
 *
 * Both halves of that route are guarded, and each has to be, because they fail differently. The
 * checker refuses the expression outright, so a document carrying one is rejected with a diagnostic
 * instead of becoming a form. The evaluator answers `false` without running the pattern, so a host
 * that built an expression by hand and never checked it is not the way in either.
 *
 * This battle is green. It exists because a guard that stops working looks exactly like a guard that
 * is working until something takes twelve seconds, and neither half had a battle.
 *
 * Each pattern runs in a child process under a budget. A pattern that does not terminate cannot be
 * measured from inside the process it is hanging.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** Valid regular expressions whose cost explodes on input that does not match. */
const CATASTROPHIC = Object.freeze(["(a+)+$", "^(a|a)*$", "^(a*)*$"]);

/** A pattern with nothing wrong with it, for the control. */
const ORDINARY = "^a+$";

/** An input a person could type into a field without trying to break anything. */
const TYPED = `${"a".repeat(28)}!`;

/** How long one condition may take before the form has stopped answering. */
const BUDGET_MS = 2000;

/**
 * Evaluate `matches` against a pattern in a child process, reporting how long it took.
 *
 * `finished` is whether the child answered at all; `answered` is what the expression said. They are
 * named apart because a condition legitimately answers `false`, and one flag for both reads that as
 * a process that never returned.
 */
function evaluateUnderBudget(pattern) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-matches-"));
  const script = join(dir, "run.mjs");
  writeFileSync(
    script,
    [
      `import { evaluateExpression } from "@modyra/core";`,
      `const started = process.hrtime.bigint();`,
      `let answered = null, error = null;`,
      `try { answered = evaluateExpression({ op: "matches", operands: [{ path: "f" }, ${JSON.stringify(pattern)}] }, { f: ${JSON.stringify(TYPED)} }); }`,
      `catch (thrown) { error = String(thrown?.message ?? thrown).slice(0, 60); }`,
      `console.log(JSON.stringify({ answered, error, ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6) }));`,
    ].join("\n"),
    "utf8",
  );

  try {
    return { finished: true, ...JSON.parse(execFileSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: BUDGET_MS,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()) };
  } catch (error) {
    // A timeout is the finding: the child was killed because the pattern was still running.
    return { finished: false, killed: error.killed === true, signal: error.signal ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Whether the published checker accepts a `matches` expression carrying `pattern`. */
function checkerAccepts(pattern) {
  const issues = validateExpression({ op: "matches", operands: [{ path: "f" }, pattern] }, ["f"]);
  return Array.isArray(issues) ? issues.length === 0 : issues === true;
}

battle(
  {
    claims: ["SEC-004", "DYN-002"],
    title: "a pattern inside a condition is refused where the condition is checked",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary pattern is accepted, so refusal below is the pattern rather than a
    // checker that refuses every `matches`.
    expectClaim(checkerAccepts(ORDINARY), {
      claimIds: ["DYN-002"],
      what: "an ordinary pattern was refused inside a condition, so nothing here is measurable",
    });

    for (const pattern of CATASTROPHIC) {
      const accepted = checkerAccepts(pattern);
      ctx.log.note("a catastrophic pattern offered to the checker", { pattern, accepted });

      expectClaim(!accepted, {
        claimIds: ["SEC-004"],
        what: `the checker accepted ${JSON.stringify(pattern)} inside a condition, so a document carrying it becomes a form`,
      });
    }

    // And a pattern that is not a pattern at all is refused rather than thrown, which is what makes
    // the refusals above a judgement about cost rather than about parsing.
    expectClaim(!checkerAccepts("["), {
      claimIds: ["SEC-004"],
      what: "an unparseable pattern was accepted inside a condition",
    });
  },
);

battle(
  {
    claims: ["SEC-004"],
    title: "a pattern that was never checked is not run either",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the evaluator answers about an ordinary pattern, through the same child process,
    // so a fast answer below is the guard rather than a harness that never evaluates anything.
    const ordinary = evaluateUnderBudget(ORDINARY);
    ctx.log.note("an ordinary pattern through the evaluator", ordinary);

    expectClaim(ordinary.finished === true && ordinary.error === null && typeof ordinary.answered === "boolean", {
      claimIds: ["SEC-004"],
      what: "the evaluator did not answer about an ordinary pattern",
      detail: JSON.stringify(ordinary),
    });

    for (const pattern of CATASTROPHIC) {
      const outcome = evaluateUnderBudget(pattern);
      ctx.log.note("a catastrophic pattern handed straight to the evaluator", { pattern, outcome });

      expectClaim(outcome.finished === true && outcome.ms < BUDGET_MS, {
        claimIds: ["SEC-004"],
        what: `evaluating a condition carrying ${JSON.stringify(pattern)} took past ${BUDGET_MS}ms`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);
