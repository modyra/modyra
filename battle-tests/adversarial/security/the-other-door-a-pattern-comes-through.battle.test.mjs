/**
 * The same catastrophic pattern, through the door nobody guarded.
 *
 * ADR 0050 put a cost check on patterns that arrive in a document's `validators.pattern`, and it
 * works: `(a+)+$` against a thirty-character input answers in milliseconds where it used to take
 * twelve seconds.
 *
 * A pattern arrives through a second door. `matches` is one of the twelve expression operators and
 * its right-hand operand is a pattern string, so a condition — a `when` on a section, a rule on a
 * field — carries one too. That door has no cost check:
 *
 *     validateExpression({ op: "matches", operands: [{ path: "v" }, "(a+)+$"] }, "w")   →  []
 *
 * Accepted, with nothing said. And evaluating it against a value somebody could type does not return.
 *
 * A `when` is read whenever the form is read. So a document with one condition of this shape does not
 * make a slow form: it makes a form that stops answering, between one keystroke and the next, which
 * is `SEC-004` in its own words.
 *
 * Both doors are measured here rather than one, because the finding is the difference between them —
 * and an ordinary pattern through the same expression door is the second control, so what is asserted
 * is the cost rather than `matches` being broken.
 *
 * The measurement runs in a child process under a budget. A pattern that does not terminate cannot be
 * timed from inside the process it is hanging, and a battle that has to be killed is one nobody keeps.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** Valid regular expressions whose cost explodes on input that does not match. */
const CATASTROPHIC = Object.freeze(["(a+)+$", "^(a|a)*$", "^(a*)*$"]);

/** An input a person could type into a field without trying to break anything. */
const TYPED = `${"a".repeat(30)}!`;

/** How long one read of one condition may take before a form has stopped answering. */
const BUDGET_MS = 1000;

/** Run one line of engine work in a child process and report whether it came back. */
function underBudget(body) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-expression-"));
  const script = join(dir, "run.mjs");
  writeFileSync(
    script,
    [
      `import { buildDynamicValidators, evaluateExpression } from "@modyra/core";`,
      `const TYPED = ${JSON.stringify(TYPED)};`,
      `const started = process.hrtime.bigint();`,
      body,
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
    return { answered: true, ms: Math.round(Number(stdout.trim().split("\n").at(-1))) };
  } catch (error) {
    // A timeout is the finding, not an error in the battle: the child was killed still running.
    return { answered: false, signal: error.signal ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const throughExpression = (pattern) =>
  underBudget(`evaluateExpression({ op: "matches", operands: [{ path: "v" }, ${JSON.stringify(pattern)}] }, { v: TYPED });`);

const throughValidator = (pattern) =>
  underBudget(`for (const v of buildDynamicValidators({ pattern: ${JSON.stringify(pattern)} }).validators) v(TYPED);`);

battle(
  {
    claims: ["SEC-004", "DYN-003"],
    title: "a pattern inside a condition costs what a pattern inside a validator costs",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: an ordinary pattern through the expression door answers at once, so what
    // follows is the cost rather than `matches` being unusable.
    const ordinary = throughExpression("^a+$");
    ctx.log.note("an ordinary pattern in a condition", ordinary);

    expectClaim(ordinary.answered && ordinary.ms < 100, {
      claimIds: ["SEC-004"],
      what: "an ordinary pattern in a condition did not answer promptly, so the budget measures the wrong thing",
      detail: JSON.stringify(ordinary),
    });

    // The second control, and the one that makes this a gap rather than an absence: the *other* door
    // takes the same pattern and answers.
    for (const pattern of CATASTROPHIC) {
      const guarded = throughValidator(pattern);
      ctx.log.note("the same pattern through the door ADR 0050 guards", { pattern, ...guarded });

      expectClaim(guarded.answered && guarded.ms < BUDGET_MS, {
        claimIds: ["SEC-004"],
        what: `the validator door no longer bounds ${JSON.stringify(pattern)}, so there is no guarded door to compare against`,
        detail: JSON.stringify(guarded),
      });
    }

    // The author-time half: nothing is reported about these where a document is read.
    const reported = CATASTROPHIC.filter(
      (pattern) => validateExpression({ op: "matches", operands: [{ path: "v" }, pattern] }, "when").length > 0,
    );
    ctx.log.note("which of them the author-time check mentions", { reported });

    // And the door itself.
    const hung = [];
    for (const pattern of CATASTROPHIC) {
      const outcome = throughExpression(pattern);
      ctx.log.note("a catastrophic pattern in a condition", { pattern, ...outcome });
      if (!outcome.answered || outcome.ms >= BUDGET_MS) hung.push({ pattern, ...outcome });
    }

    expectEqual(hung, [], {
      claimIds: ["SEC-004", "DYN-003"],
      what: `a pattern inside a condition took one read past ${BUDGET_MS}ms, where the same pattern inside a validator is bounded`,
      detail: JSON.stringify({ hung, reportedByTheAuthorTimeCheck: reported }),
    });
  },
);
