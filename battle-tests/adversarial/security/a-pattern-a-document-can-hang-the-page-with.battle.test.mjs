/**
 * The patterns the cost analyser reads as bounded, and the seconds they cost.
 *
 * `validators.pattern` arrives from a CMS, a saved project or a POST, and `dynamicPatternRefusal`
 * exists because a pattern whose syntax is perfect can stop the field answering. It refuses two
 * shapes: nested **unbounded** repetition, and repeated alternatives that can match the same text.
 *
 * **All of it is refused now**, and the table below is what it cost to find that out — kept because a
 * defence is only legible beside the attack it answers. `UNBOUNDED` was `*`, `+` and `{n,}`; a counted
 * repetition — `{15}`, `{1,10}`, `{20}` — was left alone on the grounds that bounded repetition does
 * not explode. A *counted* repetition of a group whose body matches a **variable** span is the same
 * exponential shape with the exponent written as a number, and every row here went through:
 *
 *     milliseconds by input length, one process per measurement
 *
 *                       24     26     28     30      32
 *     ^(a+){15}b$       85    284    960   3063   >8000
 *     ^(a{1,10})+b$     85    339   1353   5385   >8000
 *     ^([a-z]+){12}!$   56    146    388    959    2330
 *     ^(\w+){8}!$        9     17     30     48      81
 *     (.*a){20}$       408   1714   6592  >8000
 *     ^(a+)+b$          refused, which is the same class written with `+`
 *
 * About 3.2× for every two characters on the first two, so thirty-six characters was minutes and forty
 * was hours. `^(\w+){8}!$` grows more slowly and is the same shape; it is left out of the assertion
 * below because at these lengths it is still cheap, not because it is safe.
 *
 * `(.*a){20}$` characterised across four near misses and eight lengths: `a`s followed by a failing
 * tail go 32 ms at 20 characters and past six seconds at 30; `x`-separated `a`s reach 71 ms at 40 and
 * past six seconds at 60; nineteen `a`s and a tail grows about linearly to 1126 ms at 400; and a
 * string that matches immediately stays flat at 14 ms whatever its length. So it is the near miss
 * that costs, which is the shape an attacker sends.
 *
 * A synchronous match is the whole thread: no keystroke handled, nothing repainted. That is
 * `SEC-004` — a document cannot make the form stop answering — and the document here is one the
 * parser accepted with no diagnostic at all.
 *
 * **Measured through a killable child process.** A budget cannot be enforced from inside the thing
 * being budgeted, and a battle that hangs the suite is worse than the defect it reports. Nothing here
 * depends on a `timeout` binary.
 *
 * Green when a document's pattern either is refused at parse or settles a write inside the budget.
 * Either repair closes it: widening the analyser to count a bounded repetition of a variable body, or
 * bounding what a pattern may be matched against.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const CHILD = join(HERE, "fixtures", "pattern-under-budget.mjs");

/**
 * A budget wide enough that no ordinary machine crosses it by being slow.
 *
 * The cheapest of the accepted patterns costs 194 ms here and the dearest over eleven seconds, so a
 * second and a half separates "a regular expression ran" from "the page stopped". A slower machine
 * moves the first number and not the second: the growth is exponential in the input, so the gap
 * between a safe pattern and this one is not a factor a machine can close.
 */
const BUDGET_MS = 1500;

function measure(pattern, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CHILD, pattern, input], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      resolve(result);
    };
    const timer = setTimeout(() => finish({ killed: true }), BUDGET_MS);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("exit", () => {
      const lines = out.trim().split("\n").filter(Boolean)
        .map((line) => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
      finish(lines[lines.length - 1] ?? { crashed: true, saw: out.slice(0, 120) });
    });
  });
}

/**
 * Patterns an author writes and the analyser must keep taking.
 *
 * A refusal deletes a rule somebody wrote, so the cost of widening the analyser is paid here: a
 * fixed-length body repeated is not the exponential shape, and neither is a variable span that
 * nothing repeats. `(\d{2}){3}` is the one to watch — reading a counted repetition as unbounded,
 * rather than asking whether its body is variable, refuses it and every pattern shaped like it.
 */
const MUST_STAY_ALLOWED = Object.freeze([
  ["^(\\d{1,3}\\.){3}\\d{1,3}$", "an IPv4 address"],
  ["^([a-z]+-)*[a-z]+$", "a kebab-case slug"],
  ["^(\\w+\\.)*\\w+$", "a dotted identifier"],
  ["^(\\d+/)*\\d+$", "slash-separated numbers"],
  ["^(\\s*[^,]+,)*\\s*[^,]+$", "a comma-separated list"],
  ["^(\\d{4}[ -]?){3}\\d{4}$", "a card number in groups"],
  ["^([A-Z][a-z]+ ?){1,4}$", "a person's name, up to four words"],
  ["^(ab?){3}$", "a variable body whose split points are forced"],
  ["^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", "a hostname"],
  ["^([A-Za-z0-9]+[.-_])*[A-Za-z0-9]+@[A-Za-z0-9-]+(\\.[A-Za-z]{2,})+$", "a hand-written email"],
  // A hold-out: never shown to the rule while it was being written. The quote pins the boundary even
  // though the elastic `[^"]*` can eat the comma after it, because it cannot eat a quote.
  ["^(\"[^\"]*\",)*\"[^\"]*\"$", "a quoted comma-separated list"],
  ["(\\d{2}){3}", "a fixed-length body repeated"],
  ["^\\d{3}-\\d{4}$", "a phone number"],
  ["^[A-Z]{2}\\d{6}$", "a passport"],
  ["^(19|20)\\d{2}-\\d{2}-\\d{2}$", "an ISO date, alternation of literals"],
  ["^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$", "the ordinary email pattern"],
  ["^#[0-9a-fA-F]{6}$", "a hex colour"],
  ["^\\+?[0-9 ()-]{7,20}$", "an international phone"],
  ["^(?:[A-Z]{3}){2}$", "a non-capturing fixed body repeated"],
  ["^\\w+$", "one unbounded quantifier, not nested"],
  ["^(cat|dog)$", "an alternation that cannot overlap"],
  ["^[A-Z]{1,3}-\\d{1,4}$", "two variable spans, neither repeated"],
]);

/** Whether the parser refused this pattern for cost. */
function refusedForCost(pattern) {
  const parsed = parseDynamicForm(
    { version: 2, fields: [{ name: "v", kind: "text", label: "V", validators: { pattern } }], layout: [] },
    { mode: "lenient" },
  );
  return parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_PATTERN_TOO_COSTLY");
}

/** Each one a counted repetition of a group whose body matches a span of any length. */
const COUNTED = Object.freeze([
  ["^(a+){15}b$", "a".repeat(32)],
  // Also a hold-out. Two greedy negated classes side by side: each can take what the other can, so
  // there is no boundary between them at all. 0.08 ms at 11 characters, 338 ms at 26.
  ["^([^x]+[^y]+)+z$", "a".repeat(30)],
  // A third hold-out, aimed at the shapes the rule's own account never mentions: a lookahead around a
  // quantified body, a quantified group inside another, and two alternatives where one is a prefix of
  // the other. All three measured hot — 7 ms at 21 characters, 218 ms at 26 for the first.
  ["^((?=a)a+)+b$", "a".repeat(30)],
  ["^((ab?)+)+c$", "ab".repeat(26)],
  ["^([a-z]+|[a-z]+[0-9])+!$", "a".repeat(30)],
  ["^(a{1,10})+b$", "a".repeat(32)],
  ["^([a-z]+){12}!$", "a".repeat(32)],
  ["(.*a){20}$", `${"a".repeat(30)}b`],
]);

battle(
  {
    claims: ["SEC-004"],
    title: "a pattern a document declares cannot stop the page",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, at both ends. The analyser has to refuse the shape it already knows — otherwise a
    // run where nothing was refused would read as agreement — and a safe pattern of the same length
    // has to come back well inside the budget, or the budget is measuring the machine.
    const known = await measure("^(a+)+b$", "a".repeat(28));
    expectClaim(Array.isArray(known.refused), {
      claimIds: ["SEC-004"],
      what: "the analyser no longer refuses nested unbounded repetition, so nothing here is being compared against a working guard",
      detail: JSON.stringify(known),
    });

    const safe = await measure("^(a){15}b$", "a".repeat(28));
    expectClaim(safe.refused === undefined && safe.killed === undefined && safe.live === true, {
      claimIds: ["SEC-004"],
      what: "a safe pattern of the same shape was refused, killed, or never ran — the measurement is not sound",
      detail: JSON.stringify(safe),
    });

    // The other direction, and the expensive half of any widening: eleven patterns an author
    // actually writes, which have to keep working. Without them the cheapest way to make the
    // assertion below pass is to refuse everything.
    const wronglyRefused = MUST_STAY_ALLOWED
      .filter(([pattern]) => refusedForCost(pattern))
      .map(([pattern, why]) => `${pattern} — ${why}`);
    expectEqual(wronglyRefused, [], {
      claimIds: ["SEC-004"],
      what: "the analyser refuses a pattern that does not backtrack, so a rule an author wrote is deleted",
    });

    const overBudget = [];
    for (const [pattern, input] of COUNTED) {
      const result = await measure(pattern, input);
      ctx.log.note("a counted repetition of a variable body", { pattern, chars: input.length, result });

      if (Array.isArray(result.refused)) continue;
      if (result.crashed) { overBudget.push(`${pattern}: the child crashed — ${result.saw}`); continue; }
      if (result.live === false) { overBudget.push(`${pattern}: the rule never ran, so nothing was measured`); continue; }
      if (result.killed) { overBudget.push(`${pattern}: still matching ${input.length} characters after ${BUDGET_MS}ms`); continue; }
      if (result.ms > BUDGET_MS) overBudget.push(`${pattern}: ${result.ms.toFixed(0)}ms on ${input.length} characters`);
    }

    expectEqual(overBudget, [], {
      claimIds: ["SEC-004"],
      what: "a document's pattern was accepted and then held the thread past the budget",
    });
  },
);
