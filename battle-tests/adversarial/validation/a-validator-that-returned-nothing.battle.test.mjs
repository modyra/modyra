/**
 * The validator everybody writes, and the form it leaves behind.
 *
 * A rule returns the messages it wants shown, and none is an empty list. So this is what a person
 * writes:
 *
 *   (value) => { if (value === "taken") return ["Already taken"]; }
 *
 * There is no `else`, because there is nothing to say when the value is fine. It returns `undefined`.
 *
 * The form is built. `createForm` accepts the validator without a word, and the first read of
 * `state.valid()` throws `Cannot read properties of undefined (reading 'map')` — from inside a
 * computed, so every later read throws too. The form exists and cannot be asked anything: not its
 * validity, not through a renderer, not by a submit.
 *
 * Four shapes do it — `undefined`, `null`, a bare string, `false` — and they fail at *read* time
 * rather than where they were handed over, so the stack points at the field record and the mistake is
 * three files away in something the consumer wrote.
 *
 * The asynchronous half of the same idiom fails differently and more quietly: an async validator with
 * no `else` marks every good value invalid and shows the word **"undefined"** next to the field.
 *
 * The precedent is in the engine and recent: five setters were given a refusal at the door — an
 * argument is refused where it arrives, naming the parameter and the shape received. A validator is
 * the same kind of argument.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What happens when a form built with `validator` is asked whether it is valid. */
function askedFor(validator) {
  let form = null;
  try {
    form = createForm({ x: field("start", [validator]) }, { devWarnings: false });
  } catch (error) {
    return { refused: "at construction", message: String(error?.message ?? error) };
  }
  try {
    const valid = form.state.valid();
    return { refused: null, valid };
  } catch (error) {
    return { refused: "when read", message: String(error?.message ?? error) };
  } finally {
    form.destroy();
  }
}

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["VAL-001", "REA-002"],
    title: "a validator that returns nothing leaves a form that can still be read",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the shape the type asks for builds a form that answers.
    const proper = askedFor(() => []);
    expectEqual([proper.refused, proper.valid], [null, true], {
      claimIds: ["VAL-001"],
      what: "a validator returning an empty list did not produce a readable form, so nothing below is comparable",
      detail: JSON.stringify(proper),
    });

    const shapes = [
      ["no else branch, so undefined", (value) => { if (value === "bad") return ["bad"]; }],
      ["null", () => null],
      ["a bare string", () => "a message"],
      ["false", () => false],
    ];

    const unreadable = [];
    for (const [what, validator] of shapes) {
      const outcome = askedFor(validator);
      ctx.log.note("a validator of the wrong shape", { what, ...outcome });
      if (outcome.refused === "when read") unreadable.push({ what, message: outcome.message.slice(0, 60) });
    }

    expectEqual(unreadable, [], {
      claimIds: ["VAL-001", "REA-002"],
      what: "a validator of the wrong shape built a form that throws the first time anything asks whether it is valid — refused where it arrives, the way a setter's argument is, would name the mistake instead",
      detail: JSON.stringify(unreadable),
    });
  },
);

battle(
  {
    claims: ["VAL-001", "DYN-001"],
    title: "an async validator that returns nothing does not accuse the value",
    environments: ["node"],
  },
  async (ctx) => {
    // The same idiom, asynchronously. It does not throw — it answers, and what it says is a word.
    const outcomes = [];
    for (const [what, validator] of [
      ["no else branch", async (value) => { if (value === "taken") return ["Already taken"]; }],
      ["an explicit empty list", async (value) => (value === "taken" ? ["Already taken"] : [])],
    ]) {
      const form = createForm({ x: field("", [], { asyncValidators: [validator], asyncDebounceMs: 0 }) }, { devWarnings: false });
      form.f.x.set("free");
      await settled(160);
      outcomes.push({ what, valid: form.state.valid(), shows: form.f.x.errors().map((each) => String(each.message)) });
      form.destroy();
    }
    ctx.log.note("a value nothing is wrong with, checked two ways", { outcomes });

    // The control: written with the `else`, the value passes.
    expectEqual([outcomes[1].valid, outcomes[1].shows], [true, []], {
      claimIds: ["VAL-001"],
      what: "the explicit form did not accept a good value either, so this is not about the missing else",
    });

    expectEqual(outcomes[0].shows, [], {
      claimIds: ["VAL-001", "DYN-001"],
      what: "an async validator with no else branch marks a good value invalid and shows the word it returned",
      detail: JSON.stringify(outcomes[0]),
    });
  },
);
