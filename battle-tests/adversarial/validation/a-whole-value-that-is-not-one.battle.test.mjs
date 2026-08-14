/**
 * The one write that replaces everything, given something that is not everything.
 *
 * `setValue` takes the whole form value — not a path and a value, the whole thing — which makes it
 * the write with the largest blast radius in the public surface. It is what a consumer calls with a
 * server response, a restored session, an object built by another layer.
 *
 * Given something that is not a form value, it neither refuses nor keeps what it had. A string, a
 * number, `null`, `undefined`, an array, or an object whose keys the schema does not know all leave
 * every field holding `null` and every collection empty. Nothing is thrown, nothing is reported, and
 * the field that declared `initial: "kept"` does not hold `"kept"` — `reset()` proves it was there
 * all along.
 *
 * What settles it is the engine's own word. `explainValueMismatch("text", null)` — exported, and the
 * function that exists to answer exactly this — says `text cannot hold null`. The form is left
 * holding a value its own contract forbids while `state.valid()` reads true, and a submit from there
 * sends that null to a server.
 *
 * The assertion admits both repairs: refuse the argument, or leave the form as it was. What it does
 * not admit is the present answer, which is neither.
 */

import { createForm, explainValueMismatch, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    note: Object.freeze({ kind: "text", initial: "kept" }),
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

/** A form a user has filled in. */
function filled() {
  const form = createForm(buildSchema(SPEC).schema, {
    reactivity: vanillaReactivity(),
    devWarnings: false,
  });
  form.f.note.set("typed by the user");
  form.f.rows.upsert("a", { code: "A" });
  return form;
}

/** The values this form holds that its own contract forbids. */
function forbidden(form) {
  const value = form.getValue();
  const complaints = [];
  const note = explainValueMismatch("text", value.note);
  if (note !== null) complaints.push(`note: ${note}`);
  for (const [key, row] of Object.entries(value.rows ?? {})) {
    const cell = explainValueMismatch("text", row.code);
    if (cell !== null) complaints.push(`rows.${key}.code: ${cell}`);
  }
  return complaints;
}

battle(
  {
    claims: ["VAL-004", "SUB-001", "COL-001"],
    title: "a whole-value write that is not a whole value does not empty the form",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: given the thing it asks for, it does the thing it promises.
    const proper = filled();
    proper.setValue({ note: "new", rows: { a: { code: "B" } } });
    ctx.log.note("a whole value that is one", { value: proper.getValue() });

    expectEqual(proper.getValue().note, "new", {
      claimIds: ["VAL-004"],
      what: "a proper whole-value write did not land, so nothing below is about the argument",
    });
    proper.destroy();

    for (const [what, value] of [
      ["a string", "nope"],
      ["a number", 42],
      ["null", null],
      ["nothing at all", undefined],
      ["an array", []],
      ["an object whose keys the schema does not know", { wat: 1 }],
    ]) {
      const form = filled();
      const before = JSON.stringify(form.getValue());

      let refused = false;
      try {
        form.setValue(value);
      } catch {
        refused = true;
      }

      const after = JSON.stringify(form.getValue());
      const complaints = refused ? [] : forbidden(form);
      ctx.log.note("a whole-value write that is not a whole value", {
        what,
        refused,
        before,
        after,
        complaints,
      });

      // Refusing is a fine answer, and so is leaving the form alone. Emptying it into a shape the
      // engine's own checker condemns is the one that is not.
      expectEqual(complaints, [], {
        claimIds: ["VAL-004", "COL-001"],
        what: `setValue given ${what} left the form holding what its own contract forbids`,
        detail: `${before} became ${after}`,
      });

      // And whatever it is left holding, it must not call that valid — a form that reports itself
      // valid is one a consumer sends.
      expectClaim(refused || form.state.valid() === false || complaints.length === 0, {
        claimIds: ["SUB-001"],
        what: `setValue given ${what} left a form reporting itself valid with a value it cannot hold`,
        detail: JSON.stringify({ value: form.getValue(), valid: form.state.valid() }),
      });

      form.destroy();
    }
  },
);
