/**
 * Four artefacts that have to agree about what a field holds before anyone types.
 *
 * A blank value is decided in more than one place. `mdyEmptyValueFor` answers for a document's field.
 * A flat document builds a form through one route and a tree document through another. And
 * `MDY_VALUE_CONTRACTS` states, separately, what a value of that kind is at all — the module that
 * exists because the agreement used to be implicit, and a `daterange` handed a string still reported
 * itself conforming.
 *
 * They agree today, on every kind. That is worth holding rather than assuming, because the way this
 * breaks is by addition: a new kind reaches the vocabulary and one of the four places is updated
 * later than the others. Until then the new kind renders with a blank the engine did not choose, or
 * one its own contract says it cannot hold.
 *
 * The list is read from `MDY_DYNAMIC_FIELD_KINDS`, so a kind added anywhere is a kind asked about
 * here.
 *
 * `slider` is the one with a reason attached: it starts at its own minimum rather than at zero,
 * because a slider bounded 10–20 starting at 0 sits outside the range it declares and the first drag
 * is the only thing that would bring it back in. That is checked through the form rather than at the
 * function, since it is the form the user drags.
 */

import {
  MDY_DYNAMIC_FIELD_KINDS,
  MDY_VALUE_CONTRACTS,
  buildDynamicFormSchema,
  buildFlatFormSchema,
  createForm,
  matchesValueShape,
  mdyEmptyValueFor,
  parseDynamicFields,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Kinds that cannot be declared without something to choose from. */
const needsOptions = (kind) => /select|radio|segmented|multiselect/.test(kind);
const withOptions = (kind) => (needsOptions(kind) ? { options: [{ value: "a", label: "A" }] } : {});

/** What a form of one field of this kind holds, by each of the two document routes. */
function throughEachRoute(kind) {
  const flatForm = createForm(buildFlatFormSchema(parseDynamicFields([{ name: "x", kind, ...withOptions(kind) }])), {
    devWarnings: false,
  });
  const flat = flatForm.getValue().x;
  flatForm.destroy();

  const treeForm = createForm(
    buildDynamicFormSchema({
      node: "group",
      children: { x: { node: "field", field: { kind, label: "X", ...withOptions(kind) } } },
    }),
    { devWarnings: false },
  );
  const tree = treeForm.getValue().x;
  treeForm.destroy();

  return { flat, tree };
}

battle(
  {
    claims: ["VAL-004", "DYN-001", "SCH-001"],
    title: "every kind's blank value is the same one whichever artefact is asked",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the vocabulary and the contracts cover the same kinds. A kind missing from either
    // would make the comparisons below skip it silently.
    expectEqual(Object.keys(MDY_VALUE_CONTRACTS).sort(), [...MDY_DYNAMIC_FIELD_KINDS].sort(), {
      claimIds: ["SCH-001"],
      what: "a kind exists with no value contract, or a contract describes a kind that is not one",
    });

    const disagreed = [];
    for (const kind of MDY_DYNAMIC_FIELD_KINDS) {
      const declared = mdyEmptyValueFor({ name: "x", kind, ...withOptions(kind) });
      const { flat, tree } = throughEachRoute(kind);
      const answers = [declared, flat, tree].map((each) => JSON.stringify(each));
      if (new Set(answers).size !== 1) disagreed.push({ kind, declared, flat, tree });
    }
    ctx.log.note("kinds where the routes disagree about a blank", { disagreed });

    expectEqual(disagreed, [], {
      claimIds: ["DYN-001", "VAL-004"],
      what: "a field's blank value depends on which route built the form",
    });
  },
);

battle(
  {
    claims: ["VAL-004", "SCH-001"],
    title: "a blank value is one its own kind says it can hold",
    environments: ["node"],
  },
  async (ctx) => {
    // The shape check is the artefact that knows nothing about how a form is built. A blank value it
    // refuses is a field that starts out holding something its own contract says it cannot.
    const refused = [];
    for (const kind of MDY_DYNAMIC_FIELD_KINDS) {
      const blank = mdyEmptyValueFor({ name: "x", kind, ...withOptions(kind) });
      const contract = MDY_VALUE_CONTRACTS[kind];
      const allowed = matchesValueShape(contract.shape, blank) === true || (blank === null && contract.nullable === true);
      if (!allowed) refused.push({ kind, blank, shape: contract.shape, nullable: contract.nullable });
    }
    ctx.log.note("blank values against their own contracts", { refused });

    expectEqual(refused, [], {
      claimIds: ["VAL-004"],
      what: "a kind's blank value is one its own value contract does not allow",
    });

    // The control: the shape check refuses something, so the pass above is the values agreeing rather
    // than a checker that says yes to everything.
    expectClaim(matchesValueShape("number", "not a number") === false, {
      claimIds: ["VAL-004"],
      what: "the shape check accepts a value of the wrong shape, so nothing above was tested",
    });
  },
);

battle(
  {
    claims: ["VAL-004", "UI-001"],
    title: "a bounded slider starts inside the range it declares",
    environments: ["node"],
  },
  async (ctx) => {
    // Checked through the form rather than at the function: the form is what the user drags, and a
    // handle that starts below its own minimum is one whose first movement is the only way back in.
    for (const [field, expected] of [
      [{ name: "s", kind: "slider", min: 10, max: 20 }, 10],
      [{ name: "s", kind: "slider", min: 0, max: 20 }, 0],
      [{ name: "s", kind: "slider" }, 0],
    ]) {
      const form = createForm(buildFlatFormSchema(parseDynamicFields([field])), { devWarnings: false });
      const held = form.getValue().s;
      ctx.log.note("a slider before anyone dragged it", { declared: field.min ?? null, held });

      try {
        expectEqual(held, expected, {
          claimIds: ["UI-001"],
          what: `a slider declared ${JSON.stringify(field)} started at ${JSON.stringify(held)}`,
        });

        expectClaim(field.min === undefined || held >= field.min, {
          claimIds: ["VAL-004"],
          what: "a slider starts below the minimum it declares, outside the range it offers",
        });
      } finally {
        form.destroy();
      }
    }
  },
);
