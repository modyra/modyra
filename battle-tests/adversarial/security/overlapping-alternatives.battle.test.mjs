/**
 * The half of a catastrophic pattern the scanner still lets through.
 *
 * ADR 0050 refuses a document's pattern on structure rather than on measured cost, because a match
 * cannot be bounded from outside it. Two shapes are refused: nested unbounded repetition, and
 * repeated alternatives whose first characters overlap. Where the scanner cannot decide, it allows —
 * a refusal deletes a rule a document's author wrote, and a rule that vanishes silently is worse
 * than a slow one.
 *
 * "Cannot decide" is drawn at the character class. `^(a|a)*$` is refused; `^([a-z]|[a-z])*$` is the
 * same pattern with the same ambiguity written as a class, and it goes through. So does
 * `^(\w|[a-z])*$`, which is not a contrived pattern at all — it is what someone writes meaning "word
 * characters or letters" without noticing the second is inside the first.
 *
 * Measured here: 279ms at 22 characters, 4.5s at 26. Each additional character roughly quadruples
 * it, which is the exponential signature the ADR set out to refuse — the same defect, the same
 * blast radius, reached by writing the alternative as a class.
 *
 * The disjoint case is the control and the reason this is not "refuse all class alternation":
 * `^([a-z]|[0-9])+$` is ordinary, cannot backtrack, and answers in under a millisecond. Two classes
 * that cannot both match the same character are not ambiguous. The scanner needs to compare what the
 * branches can match, not give up at the first class.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const BATTLE_ROOT = resolve(HERE, "..", "..");

/** Patterns whose repeated alternatives overlap, written as classes rather than as literals. */
const OVERLAPPING = Object.freeze([
  "^([a-z]|[a-z])*$",
  "^([a-z]|a)*$",
  "^(\\w|[a-z])*$",
]);

/** Alternatives that cannot both match one character, which is the shape that must keep working. */
const DISJOINT = Object.freeze([
  "^([a-z]|[0-9])+$",
  "^([a-z]+|[0-9]+)$",
]);

/** An input a person could type without trying to break anything. */
const TYPED = `${"a".repeat(26)}!`;

/** How long one field's validation may take before a form has stopped answering. */
const BUDGET_MS = 1000;

/**
 * Compile a pattern the way a document does and validate one value, in a child process.
 *
 * The child is what makes the budget enforceable: a pattern that has not terminated cannot be
 * measured from inside the process it is hanging, and a battle that has to be killed is one nobody
 * keeps.
 */
function validateUnderBudget(pattern, input) {
  const dir = mkdtempSync(join(BATTLE_ROOT, ".tmp-alternation-"));
  const script = join(dir, "run.mjs");
  writeFileSync(
    script,
    [
      `import { buildDynamicValidators } from "@modyra/core";`,
      `const { validators } = buildDynamicValidators({ pattern: ${JSON.stringify(pattern)} });`,
      `if (validators.length === 0) { console.log("refused"); process.exit(0); }`,
      `const started = process.hrtime.bigint();`,
      `for (const validate of validators) validate(${JSON.stringify(input)});`,
      `console.log(String(Number(process.hrtime.bigint() - started) / 1e6));`,
    ].join("\n"),
    "utf8",
  );

  try {
    const stdout = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const answer = stdout.trim();
    if (answer === "refused") return { refused: true };
    return { refused: false, answered: true, ms: Math.round(Number(answer)) };
  } catch (error) {
    return { refused: false, answered: false, killed: error.killed === true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

battle(
  {
    claims: ["SEC-004"],
    title: "an overlapping alternative costs the same whether it is written as a literal or a class",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the reason this is a gap rather than a disagreement: the same ambiguity
    // written with literal characters is already refused.
    const literal = validateUnderBudget("^(a|a)*$", TYPED);
    ctx.log.note("the same ambiguity, written as literals", literal);

    expectClaim(literal.refused === true, {
      claimIds: ["SEC-004"],
      what: "the literal form is no longer refused, so this battle compares against nothing",
      detail: JSON.stringify(literal),
    });

    for (const pattern of OVERLAPPING) {
      const outcome = validateUnderBudget(pattern, TYPED);
      ctx.log.note("overlapping alternatives written as a class", { pattern, outcome });

      // Either refusing it or answering promptly is a pass. What is not is accepting the rule and
      // then taking the field's validation past a second on 27 characters.
      expectClaim(outcome.refused === true || (outcome.answered && outcome.ms < BUDGET_MS), {
        claimIds: ["SEC-004"],
        what: `${JSON.stringify(pattern)} was accepted and took a field's validation past ${BUDGET_MS}ms`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);

battle(
  {
    claims: ["SEC-004"],
    title: "alternatives that cannot overlap keep working",
    environments: ["node"],
  },
  async (ctx) => {
    // The other side, so a fix cannot be "refuse any alternation containing a class". These are
    // ordinary patterns and refusing them would delete rules that are perfectly safe — worse, for a
    // document's author, than the defect above.
    for (const pattern of DISJOINT) {
      const outcome = validateUnderBudget(pattern, TYPED);
      ctx.log.note("alternatives that cannot both match a character", { pattern, outcome });

      expectClaim(outcome.refused === false && outcome.answered && outcome.ms < 100, {
        claimIds: ["SEC-004"],
        what: `${JSON.stringify(pattern)} is safe and was refused or slow`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);
