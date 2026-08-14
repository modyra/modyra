/**
 * A choice the user made, coming back as one they did not.
 *
 * Three parts of the contract, each right on its own:
 *
 *   - an option's value is *whatever the option list holds*, which the value contracts state in
 *     those words — `anything non-nullish satisfies the shape`, and the same comment names `oneOf`
 *     as the thing that answers whether it is one of the offered ones;
 *   - `oneOf` answers that with `Object.is`, deliberately, because it is the anti-tampering guard
 *     for option fields: a select offering "one" and "two" must not accept a scripted `set("three")`;
 *   - a draft is written as JSON and read back as JSON.
 *
 * So an option whose value is an object cannot survive being saved. The value that comes back is
 * structurally what the user chose and is a different object, `Object.is` says no, and the form the
 * user filled in returns invalid — naming the choice they made as one that is not offered. There is
 * nothing they can do about it except pick the same thing again.
 *
 * The same reference identity is what makes the guard work, so this is not "oneOf is wrong". It is
 * that the three cannot all be used together, and nothing said so.
 */

import { createForm, field, oneOf } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Options a domain would write: an id and something to show for it. */
const OPTIONS = Object.freeze([
  Object.freeze({ id: 1, label: "One" }),
  Object.freeze({ id: 2, label: "Two" }),
]);

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 60));

battle(
  {
    claims: ["PER-003"],
    title: "a form filled in with an option comes back from its draft still valid",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const guard = oneOf(OPTIONS, "not an offered option");
    const open = () => createForm({ choice: field(null, [guard]) }, {
      draft: { key: "choice", storage },
      devWarnings: false,
    });

    const first = open();
    first.f.choice.set(OPTIONS[0]);

    // The control: the choice is a legitimate one, and the guard says so while the user is holding
    // it. Whatever happens after a restore is about the round trip rather than about the choice.
    expectClaim(first.state.valid(), {
      claimIds: ["PER-003"],
      what: "the option the user picked was refused before anything was saved",
      detail: JSON.stringify(first.errorsFor("choice")().map((each) => each.message)),
    });

    await saved();
    const envelope = storage.written.get("choice");
    ctx.log.note("the draft written for a chosen option", { bytes: envelope?.length ?? 0 });
    first.destroy();

    expectClaim(typeof envelope === "string" && envelope.includes("\"id\":1"), {
      claimIds: ["PER-003"],
      what: "the draft did not carry the option that was chosen",
      detail: String(envelope).slice(0, 120),
    });

    const second = open();
    await restored();
    ctx.log.note("the same form, reopened", {
      value: second.getValue().choice,
      valid: second.state.valid(),
    });

    // What came back is what was chosen, read as data.
    expectEqual(second.getValue().choice, { id: 1, label: "One" }, {
      claimIds: ["PER-003"],
      what: "the restored choice is not the one that was saved",
    });

    // And it has to still be a choice the form accepts. A user who left a form half-filled and came
    // back to it cannot be told that what they picked is not on the list.
    expectClaim(second.state.valid(), {
      claimIds: ["PER-003"],
      what: "a restored draft made a valid form invalid, naming the user's own choice",
      detail: JSON.stringify(second.errorsFor("choice")().map((each) => each.message)),
    });

    second.destroy();
  },
);

battle(
  {
    claims: ["PER-003", "SEC-001"],
    title: "the guard still refuses a choice that was never offered",
    environments: ["node"],
  },
  async (ctx) => {
    // The other side of the same question, so a fix cannot be "accept anything shaped like an
    // option". `oneOf` exists to refuse a scripted value, and that must keep working through a
    // round trip as well.
    const guard = oneOf(OPTIONS, "not an offered option");
    ctx.log.note("values that were never on the list", {});

    for (const invented of [{ id: 3, label: "Three" }, { id: 1 }, { id: "1", label: "One" }, "One"]) {
      expectClaim(guard(invented).length > 0, {
        claimIds: ["SEC-001"],
        what: `the guard accepted ${JSON.stringify(invented)}, which was never offered`,
      });
    }

    // And a primitive option, which is the shape that does survive JSON, is accepted both ways —
    // the control that this battle is about identity rather than about the guard being broken.
    const primitives = oneOf(["a", "b"]);
    expectEqual(primitives("a"), [], {
      claimIds: ["PER-003"],
      what: "a primitive option was refused",
    });

    expectEqual(primitives(JSON.parse(JSON.stringify("a"))), [], {
      claimIds: ["PER-003"],
      what: "a primitive option did not survive being written down and read back",
    });
  },
);
