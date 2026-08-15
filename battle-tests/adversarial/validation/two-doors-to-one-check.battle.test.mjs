/**
 * The same mistake, through two doors to one mechanism.
 *
 * A field can be given an asynchronous check two ways. `serverValidator()` is the ergonomic one the
 * guides lead with; `asyncValidators` on `field()`'s options is the lower-level pair underneath it,
 * offered in those words — *still available if you'd rather write the validator function directly*.
 * They reach the same runner.
 *
 * A check fails in more than one way, and the documented one is handled: *a rejected promise becomes
 * an `"async"` error with the rejection message*, on both doors. What is not documented and not the
 * same is a check that throws **synchronously** — a property read on something undefined, before the
 * first `await`, which is the ordinary shape of a bug in a consumer's own service call.
 *
 * Through `serverValidator` it becomes a field error, like a rejection. Through `asyncValidators` it
 * comes out of `createForm`, and the form never exists — so the page does not render because one
 * field's check had a bug in it.
 *
 * The working door is the control and the shape to copy: the mechanism can already do the right thing
 * with this, one call away.
 */

import { createForm, field, serverValidator } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

/** Build a form with one checked field and report what a consumer would see. */
async function fieldUnder(options) {
  let form;
  try {
    form = createForm({ a: field("", [], options) }, { devWarnings: false });
  } catch (error) {
    return { built: false, message: String(error?.message ?? error) };
  }
  form.f.a.set("x");
  await settled();
  const messages = form.errorsFor("a")().map((each) => String(each.message));
  const valid = form.state.valid();
  form.destroy();
  return { built: true, valid, messages };
}

battle(
  {
    claims: ["API-001", "VAL-001"],
    title: "a check that fails takes the field with it and not the form",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control, and the documented behaviour: a rejection becomes an error on the field, on
    // the lower-level door.
    const rejected = await fieldUnder({
      asyncValidators: [async () => {
        throw new Error("service is down");
      }],
      asyncDebounceMs: 0,
    });
    ctx.log.note("a promise that rejects, through asyncValidators", rejected);

    expectClaim(rejected.built && rejected.messages.includes("service is down"), {
      claimIds: ["VAL-001"],
      what: "a rejected check did not become an error on the field, so nothing below is about how it failed",
      detail: JSON.stringify(rejected),
    });

    // The second control, and the shape to copy: the same synchronous throw through the ergonomic
    // door is a field error too. The mechanism can already do this.
    const throughServerValidator = await fieldUnder(
      serverValidator(() => {
        throw new Error("undefined is not an object");
      }, { debounceMs: 0 }),
    );
    ctx.log.note("a synchronous throw, through serverValidator", throughServerValidator);

    expectClaim(
      throughServerValidator.built && throughServerValidator.messages.includes("undefined is not an object"),
      {
        claimIds: ["API-001"],
        what: "the ergonomic door does not survive a synchronous throw either, so there is no working door to compare against",
        detail: JSON.stringify(throughServerValidator),
      },
    );

    // And the same mistake through the door underneath it.
    const throughOptions = await fieldUnder({
      asyncValidators: [() => {
        throw new Error("undefined is not an object");
      }],
      asyncDebounceMs: 0,
    });
    ctx.log.note("a synchronous throw, through asyncValidators", throughOptions);

    expectEqual(throughOptions.built, true, {
      claimIds: ["API-001", "VAL-001"],
      what: "a check that threw synchronously took the whole form with it, where the same throw through serverValidator becomes a field error",
      detail: JSON.stringify(throughOptions),
    });
  },
);
