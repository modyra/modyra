/**
 * Teardown is a read path.
 *
 * A renderer unmounts, a component's teardown logs what it held, an effect that has not been
 * released yet re-evaluates once more. Every one of those reads the form after `destroy()`, and a
 * form that answers by throwing turns an ordinary unmount into an error nobody asked for.
 *
 * `submitValue()`, `state.valid()`, `fieldNames()` and `getChanges()` all answer after destroy.
 * `getValue()` and the `value` signal threw — with an internal invariant's message, not a stated
 * refusal.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SHAPES = Object.freeze([
  ["a flat schema", () => createForm({ name: field("x") })],
  ["a group", () => createForm({ address: group({ city: field("Rome") }) })],
  ["an array", () => {
    const form = createForm({ items: array(group({ sku: field("") })) });
    form.f.items.push({ sku: "A" });
    return form;
  }],
  ["a keyed collection", () => {
    const form = createForm({ rows: record(group({ code: field("") })) });
    form.f.rows.upsert("a", { code: "C" });
    return form;
  }],
]);

battle(
  {
    claims: ["LIF-001"],
    title: "a destroyed form answers a read instead of throwing at it",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [what, make] of SHAPES) {
      const form = make();
      ctx.log.note("destroying and then reading", { what });
      form.destroy();

      const outcomes = {};
      for (const [name, read] of [
        ["getValue", () => form.getValue()],
        ["value", () => form.value()],
        ["submitValue", () => form.submitValue()],
        ["fieldNames", () => form.fieldNames()],
        ["state.valid", () => form.state.valid()],
      ]) {
        try {
          outcomes[name] = { ok: true, value: read() };
        } catch (error) {
          outcomes[name] = { ok: false, message: error.message };
        }
      }

      const threw = Object.entries(outcomes).filter(([, outcome]) => !outcome.ok);
      expectClaim(threw.length === 0, {
        claimIds: ["LIF-001"],
        what: `reading ${what} after destroy`,
        detail: threw.map(([name, outcome]) => `${name}: ${outcome.message}`).join(" | "),
      });
    }
  },
);
