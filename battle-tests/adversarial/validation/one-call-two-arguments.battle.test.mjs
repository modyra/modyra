/**
 * One call, two arguments, one of them checked.
 *
 * ADR 0057 hardened `setInitialValue` by name. Its rule — "an initial value has the shape of the
 * initial it replaces" — is enforced, loudly and in production: `setInitialValue("a", 42)` on a field
 * whose initial is a string throws and names the field. The record says why a throw rather than a
 * warning, and adds "it matches the path check, which has always thrown".
 *
 * The check landed on the second argument. The first one takes anything: an object where a path
 * belongs, a name no field has, `__proto__`, `null`. Each returns without a word and without doing
 * anything, so a caller who misspelled a field learns nothing at the call and learns nothing at the
 * `reset()` that silently returns to the old initial instead of the new one.
 *
 * That makes this the sharpest of the doors that swallow an undeclared name, because the refusal
 * mechanism is not one call away — it is *in this call*, on the argument next to it. The battle
 * asserts the working half as its control for exactly that reason: a repair cannot be aimed at a
 * method that checks nothing, because this one already checks something.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A form whose initials are known, so what a later `reset()` returns to is evidence. */
function withKnownInitials() {
  const form = createForm({ a: field("start"), b: field("keep") }, { devWarnings: true });
  form.f.a.set("typed");
  return form;
}

/** Whatever reaches either console channel while one call runs, and what the call did. */
function saying(form, run) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    run();
  } catch (error) {
    said.push(`threw: ${error.message}`);
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  form.reset();
  return { said, afterReset: form.getValue() };
}

battle(
  {
    claims: ["API-001", "SEC-001", "PER-002"],
    title: "the argument that names a field is checked like the one that carries its value",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: the call works. A new initial is what a later reset returns to.
    const working = withKnownInitials();
    const applied = saying(working, () => working.setInitialValue("a", "new"));
    ctx.log.note("the call doing what it is for", applied);

    expectEqual(applied.afterReset, { a: "new", b: "keep" }, {
      claimIds: ["PER-002"],
      what: "setInitialValue did not become the value reset returns to, so this battle is not exercising it",
    });
    working.destroy();

    // The second control, and the one that matters: the *other* argument of this same call is
    // refused, out loud, by name. The mechanism is not elsewhere in the engine — it is here.
    const guarded = withKnownInitials();
    const refused = saying(guarded, () => guarded.setInitialValue("a", 42));
    ctx.log.note("the argument ADR 0057 checks", refused);

    expectClaim(refused.said.some((line) => line.startsWith("threw:") && line.includes("\"a\"")), {
      claimIds: ["SEC-001"],
      what: "the value argument was not refused by name, so ADR 0057's check is not in place here",
      detail: JSON.stringify(refused.said),
    });

    expectEqual(refused.afterReset, { a: "start", b: "keep" }, {
      claimIds: ["PER-002"],
      what: "a refused call changed what reset returns to anyway",
    });
    guarded.destroy();

    // And the argument next to it, which takes anything and reports nothing. Each of these is a call
    // a caller believed replaced an initial; each leaves `reset()` returning to the old one.
    for (const name of [{ a: "new" }, "emial", "__proto__", null, 42, ""]) {
      const form = withKnownInitials();
      const outcome = saying(form, () => form.setInitialValue(name, "new"));
      ctx.log.note("a name where a declared field belongs", { name, ...outcome });

      expectClaim(outcome.said.length > 0, {
        claimIds: ["API-001"],
        what: `setInitialValue(${JSON.stringify(name)}, "new") did nothing and said nothing`,
        detail: `reset() returned to ${JSON.stringify(outcome.afterReset)}`,
      });

      // Whatever is decided about reporting, nothing may reach a prototype through this door.
      expectClaim({}.polluted === undefined && Object.prototype.polluted === undefined, {
        claimIds: ["SEC-001"],
        what: `setInitialValue(${JSON.stringify(name)}) reached a prototype`,
      });

      form.destroy();
    }
  },
);
