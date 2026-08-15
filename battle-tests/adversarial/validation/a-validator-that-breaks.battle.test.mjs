/**
 * A rule with a bug in it, and what is left of the form.
 *
 * A validator is application code the engine calls on every write, so it can do what application
 * code does: throw. A property read on an object that turned out to be null, a helper that was not
 * imported, a locale table missing a key — none of them are the engine's fault and all of them land
 * inside a `ValidatorFn`.
 *
 * The engine already has an answer for this on the other side of the same feature. A `serverValidator`
 * check that throws becomes an error on the field carrying the thrown message: the form stays
 * readable, the field is invalid, and the application sees what happened where it can act on it.
 *
 * A synchronous validator that throws does not get that. `set()` returns normally and the exception
 * comes out of `state.valid()` instead — and out of every later read, for as long as the value stays
 * one the validator chokes on. The form cannot be rendered, and the stack points at whatever read it
 * last rather than at the write that caused it.
 *
 * Either answer is defensible: throw where the write happens, or turn it into a verdict the way the
 * async path does. What a form may not do is become unreadable.
 *
 * The third battle is the same mistake one step earlier. `asyncWhen` is the predicate that decides
 * whether a server check runs at all, and it is read while the form is being built — so a predicate
 * that throws does not make a field invalid, it makes `createForm` throw. Nothing exists to render.
 */

import { createForm, field, serverValidator, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 120));

/** Whether a read answers at all, and what it answered. */
function attempt(read) {
  try {
    return { answered: true, value: read() };
  } catch (error) {
    return { answered: false, threw: error?.constructor?.name ?? typeof error };
  }
}

battle(
  {
    claims: ["VAL-001", "LIF-001"],
    title: "a validator with a bug in it leaves a form that can still be read",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a validator that works. Everything below is about the broken one rather than
    // about a form that cannot answer at all.
    const working = createForm({ a: field("", [(value) => (value === "" ? ["required"] : [])]) }, {
      reactivity: vanillaReactivity(),
      devWarnings: false,
    });
    working.f.a.set("");
    expectClaim(working.state.valid() === false && working.errorsFor("a")().length === 1, {
      claimIds: ["VAL-001"],
      what: "a validator that works did not mark the field",
    });
    working.destroy();

    for (const [what, validator] of [
      ["throws an Error", () => { throw new Error("the rule is broken"); }],
      ["throws something that is not an Error", () => { throw "the rule is broken"; }],
    ]) {
      const form = createForm({ a: field("", [validator]) }, {
        reactivity: vanillaReactivity(),
        devWarnings: false,
      });

      const write = attempt(() => form.f.a.set("x"));
      const valid = attempt(() => form.state.valid());
      const errors = attempt(() => form.errorsFor("a")());
      const value = attempt(() => form.getValue());
      ctx.log.note("a validator that failed", { what, write, valid, errors, value });

      // A form nobody can read is a page that cannot render. Throwing at the write instead would be
      // a different answer and an acceptable one: the caller would learn where it came from.
      expectClaim(write.answered === false || valid.answered === true, {
        claimIds: ["VAL-001", "LIF-001"],
        what: `a validator that ${what} let the write through and made state.valid() throw, so the form cannot be rendered`,
        detail: JSON.stringify({ write, valid }),
      });

      try {
        form.destroy();
      } catch {
        // A form that cannot be torn down is the same finding, already stated.
      }
    }
  },
);

battle(
  {
    claims: ["VAL-001"],
    title: "the other side of the same feature turns a broken rule into a verdict",
    environments: ["node"],
  },
  async (ctx) => {
    // The precedent, measured rather than assumed: an async check that throws is a field error and
    // the form stays readable. It is what makes the battle above about a difference between two
    // paths rather than about a rule nobody could have handled.
    const form = createForm({ a: field("", [], serverValidator(async () => { throw new Error("the rule is broken"); })) }, {
      reactivity: vanillaReactivity(),
      devWarnings: false,
    });

    form.f.a.set("x");
    await settled();

    const valid = attempt(() => form.state.valid());
    const errors = attempt(() => form.errorsFor("a")().map((each) => `${each.message}`));
    ctx.log.note("an async check that failed", { valid, errors });

    expectEqual([valid.answered, valid.value], [true, false], {
      claimIds: ["VAL-001"],
      what: "an async check that threw stopped the form answering, or left it valid",
    });

    expectClaim(errors.answered && errors.value.includes("the rule is broken"), {
      claimIds: ["VAL-001"],
      what: "an async check that threw did not leave what it threw on the field",
      detail: JSON.stringify(errors),
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["VAL-001", "LIF-001"],
    title: "a predicate that decides whether to ask the server does not decide whether the form exists",
    environments: ["node"],
  },
  async (ctx) => {
    const build = (when) =>
      attempt(() => createForm(
        { a: field("", [], serverValidator(async () => ["taken"], { when })) },
        { reactivity: vanillaReactivity(), devWarnings: false },
      ));

    // The controls: the predicate decides what it is for, in both directions, and the form is built
    // either way.
    const asking = build(() => true);
    const notAsking = build(() => false);
    expectClaim(asking.answered && notAsking.answered, {
      claimIds: ["VAL-001"],
      what: "a form could not be built with a predicate that works",
      detail: JSON.stringify({ asking, notAsking }),
    });

    asking.value.f.a.set("x");
    notAsking.value.f.a.set("x");
    await settled();
    expectEqual([asking.value.state.valid(), notAsking.value.state.valid()], [false, true], {
      claimIds: ["VAL-001"],
      what: "the predicate did not decide whether the check ran",
    });
    asking.value.destroy();
    notAsking.value.destroy();

    // And the one that is read while the form is being built. A predicate is application code like
    // any other and can throw; what it must not take with it is the form.
    const broken = build(() => {
      throw new Error("the predicate is broken");
    });
    ctx.log.note("a predicate that threw", { broken });

    expectClaim(broken.answered, {
      claimIds: ["VAL-001", "LIF-001"],
      what: "a predicate that threw stopped the form being built, so there is nothing to render",
      detail: JSON.stringify(broken),
    });

    if (broken.answered) broken.value.destroy();
  },
);
