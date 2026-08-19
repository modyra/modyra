/**
 * A document refused whole, and a count that stops at ten thousand.
 *
 * `parse.ts` explains why `acceptedCount` and `rejectedCount` exist, and the reason is that numbers
 * must not lie:
 *
 * > What the document said it had, counted before anything is refused. A schema the validator turns
 * > down wholesale never reaches the walk, so **without this a document declaring three children
 * > reported none accepted and none rejected — three entered and nothing came out, with the counts
 * > saying nothing happened.**
 *
 * `declaredFieldCount` walks the raw object over an explicit stack, with a bound: *"A bound, because
 * the count is taken before the depth and size checks have run."* The bound is right — the count runs
 * on a shape nothing has validated yet, so it must not be able to spin. What it costs is that beyond
 * ten thousand nodes the number it produces is not the number of things that were declared:
 *
 *   declared    accepted   rejected   unaccounted for
 *      101            0        101           0
 *    10 000           0      9 999           1
 *    10 002           0      9 999           3
 *    50 001           0      9 999      40 002
 *
 * So a document that lost fifty thousand fields reports having lost nine thousand nine hundred and
 * ninety-nine, and a host reading those numbers to decide how much of a generated document survived
 * — which is what `ai-generated-forms.md` teaches, `// 5 fields kept, 4 dropped` — is told a number
 * off by a factor of five.
 *
 * When every field is accepted the counts are exact at fifty thousand, because that path counts what
 * the walk produced rather than what the raw object declared. It is only the refused-whole path,
 * which is the one the counts were added for, that saturates.
 *
 * The battle does not ask for the bound to be removed: a count taken before validation must be able
 * to stop. It asks that the numbers add up **or that the document is told they do not** — a saturated
 * count reported as a count is the failure the comment describes, one order of magnitude up.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = () => ({ node: "field", field: { kind: "text", label: "L" } });

/**
 * A schema of `count` sound fields plus one the validator refuses outright, which is what makes the
 * whole schema go down and the declared count the only thing left to report.
 */
function refusedWholeWith(count) {
  const children = { ["__proto__"]: leaf() };
  for (let index = 0; index < count; index += 1) children[`f${index}`] = leaf();
  const parsed = parseDynamicForm({ version: 2, schema: { node: "group", children } }, { mode: "strict" });
  return {
    declared: count + 1,
    accepted: parsed.acceptedCount,
    rejected: parsed.rejectedCount,
    codes: parsed.diagnostics.map((each) => each.code),
  };
}

battle(
  {
    claims: ["DYN-004", "SEC-004"],
    title: "the counts add up, or say that they do not",
    environments: ["node"],
  },
  async (ctx) => {
    const sizes = [101, 10_000, 50_001];
    const observed = sizes.map((size) => refusedWholeWith(size - 1));
    ctx.log.note("what each refused document says it declared", observed);

    // The instrument: the small document must add up, and every one of them must actually have been
    // refused — otherwise "the numbers are wrong" would describe documents that were accepted.
    const small = observed[0];
    expectClaim(
      small.accepted + small.rejected === small.declared &&
        observed.every((row) => row.accepted === 0 && row.codes.includes("MDY_DYNAMIC_UNSAFE_NAME")),
      {
        claimIds: ["DYN-004"],
        what: "a small refused document does not add up either, or a document was not refused, so the probe is wrong before the contract is",
        detail: JSON.stringify(observed),
      },
    );

    expectEqual(
      observed
        .filter((row) => row.accepted + row.rejected !== row.declared)
        .map((row) => ({ declared: row.declared, counted: row.accepted + row.rejected })),
      [],
      {
        claimIds: ["DYN-004", "SEC-004"],
        what: "a document reported fewer declarations than it carried, so a host reading the counts to see how much of a generated document survived is told a number that saturates",
      },
    );
  },
);
