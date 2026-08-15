/**
 * A field name with a typo in it, through every door that takes one.
 *
 * `devWarnings` is documented in one sentence: "the calls that could not do anything, and the choices
 * a mechanism cannot make for you". It is one switch on purpose — "turning off part of it would leave
 * a reader wondering which part they had".
 *
 * It works. Renaming a row onto a key another row already has is a call that could not do anything,
 * and with warnings on the engine says so, names both keys and says what to do instead:
 *
 *   [modyra] rename on "rows" ignored: "b" already names a row, and moving onto it would replace it.
 *
 * A patch naming a field nobody declared is the same kind of call and says nothing. So do five more.
 * `patch`, `patchValue`, `setValue`, `record.upsert`, `record.patch` and `setDisabled` all accept a
 * name that is not in the schema, do nothing with it, and report nothing — with `devWarnings: true`.
 *
 * A typed consumer is protected by their compiler. The doors this matters at are the ones where the
 * keys come from data: a document, a server, a saved project, a form built from a response. There the
 * name is a string that came from somewhere, and the difference between "applied" and "silently
 * ignored" is the difference between a form that shows what arrived and one that does not.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Run `act` on a fresh form with warnings on, and collect what the engine said. */
function whatItSaid(act) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));

  const form = createForm({ email: field(""), rows: record(group({ code: field("") })) }, { devWarnings: true });
  try {
    form.f.rows.upsert("a", { code: "A" });
    act(form);
    return { said, value: form.getValue() };
  } finally {
    console.warn = realWarn;
    console.error = realError;
    form.destroy();
  }
}

battle(
  {
    claims: ["REA-002", "SUB-001"],
    title: "a call that could not do anything says so",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the mechanism exists, the vocabulary exists, and one call already uses both.
    const rename = whatItSaid((form) => {
      form.f.rows.upsert("b", { code: "B" });
      form.f.rows.rename("a", "b");
    });
    ctx.log.note("a rename onto an occupied key", { said: rename.said });

    expectClaim(rename.said.some((line) => line.includes("rename on") && line.includes("ignored")), {
      claimIds: ["REA-002"],
      what: "the engine says nothing about a rename onto an occupied key either, so `devWarnings` is not the mechanism this battle thinks it is",
      detail: JSON.stringify(rename.said),
    });

    // And the same kind of call, six ways, with a name the schema does not have.
    const doors = {
      "patch": (form) => form.patch({ emial: "x" }),
      "patchValue": (form) => form.patchValue({ emial: "x" }),
      "setValue": (form) => form.setValue({ email: "e", emial: "x", rows: {} }),
      "record.upsert": (form) => form.f.rows.upsert("a", { coed: "x" }),
      "record.patch": (form) => form.f.rows.patch({ a: { coed: "x" } }),
      "setDisabled": (form) => form.setDisabled("emial", () => true),
    };

    const silent = [];
    for (const [door, act] of Object.entries(doors)) {
      const outcome = whatItSaid(act);
      ctx.log.note("a name nobody declared", { door, said: outcome.said });
      if (outcome.said.length === 0) silent.push(door);
    }

    expectEqual(silent, [], {
      claimIds: ["REA-002", "SUB-001"],
      what: "a name the schema does not have was accepted, did nothing, and was not reported — with devWarnings on, which is documented as reporting the calls that could not do anything",
      detail: JSON.stringify(silent),
    });
  },
);
