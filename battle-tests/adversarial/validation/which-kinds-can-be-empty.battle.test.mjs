/**
 * Which kinds can be empty, and what that costs a `required`.
 *
 * `MDY_VALUE_CONTRACTS` carries a `nullable` for every kind, and the comment introducing the table
 * calls it *"the half that matters most: the difference between a field that can be empty and one
 * that cannot, and therefore between a `required` that can fail and one that cannot"*. It then names
 * the exceptions: *"the two kinds that are not nullable — `slider` and the booleans"*.
 *
 * Both halves of that sentence are worth pinning, because neither is what the table below it says.
 * Eleven of the seventeen kinds are not nullable, and `required` fails on the empty value of every
 * kind but one — including `checkbox` and `toggle`, the sentence's own examples, where refusing an
 * unticked box is the whole point of a consent field.
 *
 * The behaviour is not in question here and this battle is green: a slider's thumb is always
 * somewhere, so its `required` has nothing to refuse, and everything else can be left empty and told
 * so. What is pinned is the shape of the table and the shape of the answer, so that a change to
 * either becomes visible — and so that the prose can be corrected against a measurement rather than
 * against a reading.
 */

import { MDY_VALUE_CONTRACTS, createForm, field, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The empty value each kind's contract describes, written out because it is what a user leaves behind. */
const EMPTY = Object.freeze({
  text: "", textarea: "", email: "", password: "", colors: "",
  number: null, slider: 0,
  checkbox: false, toggle: false,
  select: null, radio: null, segmented: null,
  multiselect: [], file: [],
  datepicker: null, timepicker: null,
  daterange: { start: null, end: null },
});

battle(
  {
    claims: ["VAL-004"],
    title: "a required refuses the empty value of every kind whose empty value is not a real one",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: the table covers every kind this battle asks about, so a missing entry is a new
    // kind nobody measured rather than a silent pass.
    expectEqual(Object.keys(MDY_VALUE_CONTRACTS).sort(), Object.keys(EMPTY).sort(), {
      claimIds: ["VAL-004"],
      what: "the value contracts and this battle no longer describe the same set of kinds",
    });

    const notNullable = Object.entries(MDY_VALUE_CONTRACTS)
      .filter(([, contract]) => contract.nullable === false)
      .map(([kind]) => kind)
      .sort();
    ctx.log.note("kinds whose contract says they cannot be empty", { notNullable });

    // Eleven, not two. Pinned as a list rather than a count so that which ones changes visibly.
    expectEqual(notNullable, [
      "checkbox", "colors", "daterange", "email", "file", "multiselect",
      "password", "slider", "text", "textarea", "toggle",
    ], {
      claimIds: ["VAL-004"],
      what: "the set of kinds declared non-nullable moved",
    });

    const refuses = [];
    for (const [kind, empty] of Object.entries(EMPTY)) {
      const form = createForm({ v: field(empty, [required()]) }, { devWarnings: false });
      if (!form.state.valid()) refuses.push(kind);
      form.destroy();
    }
    ctx.log.note("kinds whose required refuses their empty value", { refuses: refuses.sort() });

    // The control: a required that never fails anywhere would make the list below meaningless.
    expectClaim(refuses.length > 1, {
      claimIds: ["VAL-004"],
      what: "required refused almost nothing, so this battle is not measuring it",
      detail: () => JSON.stringify(refuses),
    });

    // And the one kind it cannot refuse, which is the sentence's real content: a thumb is always
    // somewhere, so a slider has no empty to name.
    expectEqual(Object.keys(EMPTY).filter((kind) => !refuses.includes(kind)), ["slider"], {
      claimIds: ["VAL-004"],
      what: "the set of kinds whose required cannot fail is not the one this contract describes",
    });
  },
);
