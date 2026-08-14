/**
 * One form written two ways, and made to enforce something.
 *
 * A document reaches the engine as a flat field list or as a tree, and both are published routes:
 * `buildFlatFormSchema` + `applyFlatValidators` for the first, `buildDynamicFormSchema` for the
 * second. DYN-001 is the promise that they agree, and the existing differential compares a typed
 * schema against a dynamic one rather than the two dynamic shapes against each other.
 *
 * Each case is asserted to *bite* before the two are compared, which is the point. A first version
 * of this check compared the two routes on a field it had declared `required: true` at the top
 * level — a spelling the published spec does not have, `required` living inside `validators` — and
 * on a flat route missing its second call. Neither form enforced anything, the two agreed perfectly,
 * and the check passed while proving that two empty forms are empty in the same way.
 *
 * So every rule here is first shown to refuse a value, and only then compared.
 */

import {
  applyFlatValidators,
  buildDynamicFormSchema,
  buildFlatFormSchema,
  createForm,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Each case: the field as the spec spells it, and a value that must be refused. */
const CASES = Object.freeze([
  ["required", { kind: "text", validators: { required: true } }, ""],
  ["a length floor", { kind: "text", validators: { minLength: 5 } }, "ab"],
  ["a length ceiling", { kind: "text", validators: { maxLength: 2 } }, "abcdef"],
  ["a pattern", { kind: "text", validators: { pattern: "^a+$" } }, "b"],
  ["an email", { kind: "text", validators: { email: true } }, "not-an-email"],
  ["a number floor", { kind: "number", validators: { min: 10 } }, 3],
  ["a number ceiling", { kind: "number", validators: { max: 10 } }, 30],
]);

const open = (schema) => createForm(schema, { reactivity: vanillaReactivity(), devWarnings: false });

/** What a consumer can see about one field holding one value. */
function observe(form, value) {
  form.f.a.set(value);
  return {
    valid: form.state.valid(),
    required: form.getField("a")?.().required?.() ?? null,
    messages: form.errorsFor("a")().map((each) => each.message).sort(),
  };
}

battle(
  {
    claims: ["DYN-001", "VAL-004"],
    title: "a rule written flat and written as a tree refuses the same value the same way",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [what, field, refusable] of CASES) {
      const flatFields = [{ name: "a", ...field }];
      const flat = open(buildFlatFormSchema(flatFields, []));
      applyFlatValidators(flat, flatFields);

      const tree = open(
        buildDynamicFormSchema({
          node: "group",
          children: { a: { node: "field", field: { label: "A", ...field } } },
        }),
      );

      const fromFlat = observe(flat, refusable);
      const fromTree = observe(tree, refusable);
      ctx.log.note("one rule, two shapes", { what, fromFlat, fromTree });

      // The rule bites. Without this the comparison below passes for two forms that enforce nothing,
      // which is exactly how the first version of this battle passed while proving nothing.
      expectClaim(fromTree.valid === false, {
        claimIds: ["VAL-004"],
        what: `${what}: the tree shape accepted a value the rule refuses, so the comparison proves nothing`,
        detail: JSON.stringify(fromTree),
      });

      expectEqual(fromFlat, fromTree, {
        claimIds: ["DYN-001"],
        what: `${what}: the two shapes of one document disagree about the same value`,
      });

      flat.destroy();
      tree.destroy();
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-002"],
    title: "a collection written flat and written as a tree is the same collection",
    environments: ["node"],
  },
  async (ctx) => {
    for (const kind of ["record", "array"]) {
      const item = {
        node: "group",
        children: { code: { node: "field", field: { kind: "text", label: "C" } } },
      };
      const tree = open(buildDynamicFormSchema({ node: "group", children: { rows: { node: kind, item } } }));
      const flat = open(buildFlatFormSchema([], [{ path: "rows", kind }]));

      const shape = (form) => ({
        value: form.getValue().rows,
        isArray: Array.isArray(form.getValue().rows),
        names: form.fieldNames().sort(),
      });
      ctx.log.note("an empty collection in both shapes", { kind, tree: shape(tree), flat: shape(flat) });

      // The kind is the promise DYN-002 makes, and an empty collection is where the two routes can
      // still be compared: what a declared row does to a rebuilt one is a separate battle.
      expectEqual(shape(flat), shape(tree), {
        claimIds: ["DYN-001", "DYN-002"],
        what: `a ${kind} built from a flat declaration is not the one built from a tree`,
      });

      flat.destroy();
      tree.destroy();
    }
  },
);
