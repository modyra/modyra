/**
 * A server saying no, spelled the four ways a server says it.
 *
 * The action a consumer hands `submit` returns `MdyFormError[]`, and the engine routes each one by
 * its `path`: to the field it names, or — for a path the form does not have — to `errorsFor("")`,
 * which the security guide states in those words. That is the surface an application renders as
 * "we could not save this", and it is the last thing standing between a refused submission and a
 * user who thinks it worked.
 *
 * Two spellings hold. `path: null` is a form-level error and lands there; a path naming a real field
 * lands on the field; a path naming no field lands form-level, as documented.
 *
 * Two do not, and both are ordinary. `path: ""` — the explicit way to say *this is about the whole
 * form* — is dropped entirely: not on a field, not form-level, not even in `lastSubmitErrors`. The
 * server's sentence is gone. And **omitting `path`**, which is what `{ message }` from a server
 * response looks like, produces a form-level error reading `Cannot read properties of undefined
 * (reading 'length')` — a JavaScript runtime message, on the surface an application shows a person.
 *
 * The form stays valid through all of it, which is correct — a server's refusal is not a validator's
 * verdict — and is also why the loss is quiet.
 */

import { createForm, field, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Submit once with one error and hand back where it landed. */
async function refusedWith(error) {
  const form = createForm({ a: field("x") }, { reactivity: vanillaReactivity(), devWarnings: false });
  await form.submit(async () => [error]);
  const landed = {
    formLevel: form.errorsFor("")().map((each) => `${each.message}`),
    onField: form.errorsFor("a")().map((each) => `${each.message}`),
    kept: form.state.lastSubmitErrors().length,
  };
  form.destroy();
  return landed;
}

battle(
  {
    claims: ["SUB-001", "SEC-001"],
    title: "a refusal the server sent reaches somebody, however it is addressed",
    environments: ["node"],
  },
  async (ctx) => {
    const MESSAGE = "the whole form is wrong";

    // The controls: the two spellings that work, and the documented routing for a path the form
    // does not have. Without these a battle about the others would be about submit itself.
    const byNull = await refusedWith({ path: null, message: MESSAGE });
    expectEqual(byNull.formLevel, [MESSAGE], {
      claimIds: ["SUB-001"],
      what: "a form-level error addressed with a null path did not reach the form-level surface",
    });

    const byField = await refusedWith({ path: "a", message: "this field is wrong" });
    expectEqual(byField.onField, ["this field is wrong"], {
      claimIds: ["SUB-001"],
      what: "an error naming a field did not reach it",
    });

    const byUnknown = await refusedWith({ path: "nope", message: "a field nobody declared" });
    expectEqual(byUnknown.formLevel, ["a field nobody declared"], {
      claimIds: ["SEC-001", "SUB-001"],
      what: "an error naming a path the form does not have was not surfaced form-level",
    });

    // The empty string is the other way of saying "the whole form", and it says nothing at all.
    const byEmpty = await refusedWith({ path: "", message: MESSAGE });
    ctx.log.note("a refusal addressed to the empty path", byEmpty);

    expectClaim(byEmpty.formLevel.length + byEmpty.onField.length + byEmpty.kept > 0, {
      claimIds: ["SUB-001"],
      what: "a refusal addressed to the empty path was dropped: not on a field, not form-level, and not kept",
      detail: JSON.stringify(byEmpty),
    });

    // And the shape a server response has when it simply says what went wrong.
    for (const [what, error] of [
      ["path omitted", { message: MESSAGE }],
      ["path undefined", { path: undefined, message: MESSAGE }],
    ]) {
      const landed = await refusedWith(error);
      ctx.log.note("a refusal with no path at all", { what, landed });

      const internal = [...landed.formLevel, ...landed.onField].filter((message) =>
        /Cannot read properties|is not a function|is not iterable|undefined is not/.test(message));

      expectEqual(internal, [], {
        claimIds: ["SUB-001", "SEC-001"],
        what: `a refusal with ${what} put a JavaScript runtime message on the surface a person reads`,
        detail: JSON.stringify(landed),
      });

      expectClaim(landed.formLevel.includes(MESSAGE) || landed.onField.includes(MESSAGE), {
        claimIds: ["SUB-001"],
        what: `a refusal with ${what} did not carry what the server actually said`,
        detail: JSON.stringify(landed),
      });
    }
  },
);
