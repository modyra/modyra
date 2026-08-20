/**
 * The value contract, on the two doors a document can be built through.
 *
 * A kind says what a value of it may be — `MDY_VALUE_CONTRACTS`, and `explainValueMismatch` is the
 * published oracle for it. `valueShape` turns that into a validator, and `buildDynamicFormSchema`
 * attaches one to every leaf. `buildFlatFormSchema` attaches none.
 *
 * Both are published, and the flat one is where `flattenDynamicForm`'s own output goes — so the same
 * document, flattened and rebuilt, stops refusing values its kinds cannot hold:
 *
 *     kind         value                              tree     flat
 *     timepicker   "not a time at all"                invalid  valid
 *     datepicker   "not a date at all"                invalid  valid
 *     number       "not a number"                     invalid  valid
 *     checkbox     "yes"                              invalid  valid
 *     slider       "loud"                             invalid  valid
 *     daterange    { start: "nope", end: "nope" }     invalid  valid
 *     colors       42                                 invalid  valid
 *
 * The consequence is the one `valueShape` was written for, stated in its own comment: a form calling
 * itself valid and submittable while a field holds what the kind cannot hold. A value from outside
 * the control is where that arrives — a tampered draft, a server response, a scripted write — and it
 * is `VAL-005` on the far side: the server is asked about a value the field's own rules would have
 * refused, on one door out of two.
 *
 * The differential beside this one, `two-ways-to-build-one-shape`, compares what the two routes
 * *hold* and finds them identical. This asks what they *refuse*, which is the half a value comparison
 * cannot see.
 *
 * Green when a value a kind's contract condemns is refused by whichever builder made the form. The
 * candidate values are not written by hand: each is one `explainValueMismatch` itself rejects, so a
 * kind added later is covered without touching this file.
 */

import {
  buildDynamicFormSchema,
  buildFlatFormSchema,
  createForm,
  explainValueMismatch,
  flattenDynamicForm,
  MDY_VALUE_CONTRACTS,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));

/** Values offered to every kind; the contract itself picks which one it refuses. */
const CANDIDATES = Object.freeze([
  "not a value of this kind",
  42,
  true,
  { start: "nope", end: "nope" },
  ["nope"],
]);

/** The first candidate this kind's own oracle condemns, or null when it accepts all of them. */
function refusedBy(kind) {
  for (const candidate of CANDIDATES) {
    if (explainValueMismatch(kind, candidate) !== null) return candidate;
  }
  return null;
}

/**
 * A one-field document of this kind, or `null` when it cannot be built at all.
 *
 * A kind that offers choices refuses to compile without a list — *"the options for \"v\" must each
 * name a value"* — and one that does not may refuse the member. Both are asked, in that order, so a
 * kind is skipped only when neither shape compiles, and the skips are asserted below rather than
 * quietly dropped.
 */
function treeFor(kind) {
  const OPTIONS = [{ value: "a", label: "A" }];
  for (const field of [{ kind, label: "V" }, { kind, label: "V", options: OPTIONS }]) {
    const tree = { node: "group", children: { v: { node: "field", field } } };
    try {
      buildDynamicFormSchema(tree);
      return tree;
    } catch { /* the other shape, then nothing */ }
  }
  return null;
}

async function verdictOf(schema, value) {
  const form = createForm(schema, { devWarnings: false });
  await settled();
  form.setValue({ v: value });
  form.markAllTouched();
  await settled();
  const verdict = form.state.valid();
  form.destroy();
  return verdict;
}

battle(
  {
    claims: ["VAL-005", "DYN-003"],
    title: "a value a kind cannot hold is refused by whichever builder made the form",
    environments: ["node"],
  },
  async (ctx) => {
    const disagreed = [];
    const skipped = [];
    let checked = 0;

    for (const kind of Object.keys(MDY_VALUE_CONTRACTS).sort()) {
      const bad = refusedBy(kind);
      if (bad === null) continue;

      // A kind that offers choices refuses to compile without them, and the list it is given is
      // beside the point here: what is under test is the value check, which every kind has.
      const tree = treeFor(kind);
      if (tree === null) { skipped.push(kind); continue; }
      const flattened = flattenDynamicForm(tree);

      const fromTree = await verdictOf(buildDynamicFormSchema(tree), bad);
      const fromFlat = await verdictOf(buildFlatFormSchema(flattened.fields, flattened.collections), bad);
      ctx.log.note("one kind, two builders", { kind, value: bad, fromTree, fromFlat });

      checked += 1;
      if (fromTree !== fromFlat) disagreed.push(`${kind}: tree ${fromTree ? "valid" : "invalid"}, flat ${fromFlat ? "valid" : "invalid"}`);
    }

    // The control on the selection: the oracle has to have condemned something for most kinds, or
    // this battle would be reporting agreement about an empty list.
    expectClaim(checked >= 8, {
      claimIds: ["DYN-003"],
      what: "the value contracts refused none of the candidates, so nothing was compared",
      detail: `${checked} kind(s) of ${Object.keys(MDY_VALUE_CONTRACTS).length}`,
    });

    ctx.log.note("kinds no single-field document could be built for", skipped);

    expectEqual(disagreed, [], {
      claimIds: ["VAL-005", "DYN-003"],
      what: "the two published builders disagree about whether a value its kind cannot hold makes the form invalid",
    });
  },
);
