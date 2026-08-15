/**
 * Asking a handle which form built it.
 *
 * `registerHandleForm` and `handleFormOf` are a registry a form fills in as it builds its handles, so
 * anything holding one can find its way back without being passed the form as well. A widget given a
 * handle and nothing else is the case it exists for.
 *
 * Its documented shape is the interesting part: `undefined` for a handle nobody registered — one
 * built by hand, or from a version that predates the registry — and the comment says in those words
 * that a caller should fall back to the form it already has *rather than treat that as an error*. A
 * registry that threw instead would make every hand-built handle a crash.
 *
 * The last of the core exports nothing in this suite had named.
 */

import { createForm, field, handleFormOf, registerHandleForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["REA-001", "API-001"],
    title: "a handle knows the form that built it, and an unregistered one is not an error",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ a: field("A"), b: field("B") }, { devWarnings: false });

    expectClaim(handleFormOf(form.f.a) === form && handleFormOf(form.f.b) === form, {
      claimIds: ["REA-001"],
      what: "a handle a form built does not lead back to it",
    });

    // Two forms, so the registry is telling them apart rather than answering with the only one there.
    const other = createForm({ a: field("A") }, { devWarnings: false });
    ctx.log.note("two forms, one field name", {
      first: handleFormOf(form.f.a) === form,
      second: handleFormOf(other.f.a) === other,
      crossed: handleFormOf(other.f.a) === form,
    });

    expectClaim(handleFormOf(other.f.a) === other && handleFormOf(other.f.a) !== form, {
      claimIds: ["REA-001"],
      what: "two forms sharing a field name lead back to the same one",
    });

    // A handle nobody registered: an answer, not a throw.
    let answered = "threw";
    try {
      answered = handleFormOf({ path: "hand-built", value: () => null });
    } catch {
      answered = "threw";
    }

    expectEqual(answered, undefined, {
      claimIds: ["API-001"],
      what: "a handle nobody registered was not answered with undefined, so a caller cannot fall back",
    });

    // And a caller may register one itself, which is what the pair is for.
    const mine = { path: "mine" };
    registerHandleForm(mine, form);
    expectClaim(handleFormOf(mine) === form, {
      claimIds: ["API-001"],
      what: "a handle a caller registered does not lead to the form it was registered against",
    });

    other.destroy();
    form.destroy();
  },
);

battle(
  {
    claims: ["REA-001", "LIF-001"],
    title: "a handle still knows its form after the form has ended",
    environments: ["node"],
  },
  async (ctx) => {
    // Deliberate rather than accidental: a destroyed form still answers for what it held, so the
    // route from a handle to it has to survive too. A widget torn down after its form would
    // otherwise lose the ability to read the last value it was showing.
    const form = createForm({ a: field("A") }, { devWarnings: false });
    const handle = form.f.a;

    form.destroy();

    const found = handleFormOf(handle);
    ctx.log.note("what a handle leads to after its form ended", {
      same: found === form,
      value: found?.getValue(),
      submitted: found?.submitValue(),
    });

    expectClaim(found === form, {
      claimIds: ["REA-001"],
      what: "a handle stopped leading to its form once the form ended, so a widget outliving it has nowhere to look",
    });

    // What it answers there is the destroyed form's own contract, pinned here because the route is
    // what makes it reachable: the last value it held, and nothing to submit.
    expectEqual(found.getValue(), { a: "A" }, {
      claimIds: ["LIF-001"],
      what: "a form reached through a handle after it ended does not report what it held",
    });

    expectEqual(found.submitValue(), {}, {
      claimIds: ["LIF-001"],
      what: "a form that has ended offered something to submit",
    });
  },
);
