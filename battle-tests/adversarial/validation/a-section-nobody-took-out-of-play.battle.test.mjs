/**
 * A section a caller took out of play, and a form that never heard.
 *
 * The engine takes a whole section out of play at runtime, reactively, and does it correctly:
 * `group(children, { when })` fed a real signal drops the section from the submitted value when the
 * signal goes false and puts it back when it returns. That is the capability.
 *
 * `setDisabled`, `setInactive` and `setReadonly` are the imperative half — ADR 0044 calls
 * `setDisabled` "how a control states what a user may do with a field" — and they sit on three
 * consecutive lines of the same interface, all taking `(name, signal)`. Given the path of a group,
 * all three return without doing anything and without saying anything, `devWarnings: true` included.
 *
 * The consequence is not at the call. A consumer who writes
 * `setDisabled("billing", () => !wantsBilling())` ships a section that stays editable and stays in
 * the payload, and the first evidence is on a server. What they read while writing it is VAL-002 —
 * *disabled values are retained in edit state and excluded from submission* — which is true of every
 * field that is disabled, and says nothing about a call that failed to disable one.
 *
 * The battle asserts the capability and the working leaf call as controls, because a repair cannot be
 * aimed at either: the engine can do this, and this method does work one path segment deeper.
 */

import { createForm, field, group, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** What a submit would send right now. */
async function submitted(form) {
  let payload = null;
  await form.submit((value) => {
    payload = value;
  });
  return payload;
}

/** A form with one section and one field beside it, so an exclusion is visible as an absence. */
function withASection(options = {}) {
  return createForm(
    { sect: group({ inner: field("i") }, options), plain: field("p") },
    { devWarnings: true },
  );
}

battle(
  {
    claims: ["API-001"],
    title: "the three ways to take something out of play agree about a section",
    environments: ["node"],
  },
  async (ctx) => {
    const reactivity = vanillaReactivity();

    // The first control: the engine does this, at runtime, in both directions.
    const open = reactivity.signal(true);
    const declared = withASection({ when: () => open() });
    await settled();
    const whileOpen = await submitted(declared);
    open.set(false);
    await settled();
    const whileClosed = await submitted(declared);
    open.set(true);
    await settled();
    const reopened = await submitted(declared);
    ctx.log.note("a section a condition closes and opens", { whileOpen, whileClosed, reopened });

    expectEqual([whileOpen, whileClosed, reopened], [
      { plain: "p", sect: { inner: "i" } },
      { plain: "p" },
      { plain: "p", sect: { inner: "i" } },
    ], {
      claimIds: ["API-001"],
      what: "a condition did not take a section out of the payload and put it back, so the capability under comparison is not there",
    });
    declared.destroy();

    // The second control: the same method, one path segment deeper, does what it says.
    const leaf = withASection();
    leaf.setDisabled("sect.inner", () => true);
    await settled();
    ctx.log.note("the same call on the field inside", {
      disabled: leaf.f.sect.inner.disabled(),
      submitted: await submitted(leaf),
    });

    expectClaim(leaf.f.sect.inner.disabled() === true, {
      claimIds: ["API-001"],
      what: "setDisabled did not disable the field it names, so this battle is not exercising it",
    });
    leaf.destroy();

    // And the three calls that name the section. Each is a call a caller believed took a section out
    // of play; each leaves it editable and in the payload, without a word.
    for (const method of ["setDisabled", "setInactive", "setReadonly"]) {
      const said = [];
      const realWarn = console.warn;
      const realError = console.error;
      const form = withASection();
      const flag = reactivity.signal(false);

      console.warn = (...parts) => said.push(parts.join(" "));
      console.error = (...parts) => said.push(parts.join(" "));
      try {
        form[method]("sect", () => flag());
      } catch (error) {
        said.push(`threw: ${error.message}`);
      } finally {
        console.warn = realWarn;
        console.error = realError;
      }

      await settled();
      flag.set(true);
      await settled();
      const payload = await submitted(form);
      ctx.log.note("a section named to an interactivity setter", {
        method,
        disabled: form.f.sect.inner.disabled(),
        payload,
        said,
      });

      expectClaim(said.length > 0, {
        claimIds: ["API-001"],
        what: `${method}("sect", …) did nothing to the section and said nothing`,
        detail: `the field inside reports disabled=${form.f.sect.inner.disabled()} and the payload is still ${JSON.stringify(payload)}`,
      });

      form.destroy();
    }
  },
);
