/**
 * Two forms given one draft key, and which of them the protection is for.
 *
 * The draft manager refuses to write over work that is not its own, and says so twice, in the order
 * the two refusals happen:
 *
 *     MDY_DRAFT_NOT_RESTORED   on opening — it declines to restore a draft that is not its own
 *     MDY_DRAFT_KEY_IN_USE     on saving  — *"a draft under this key holds paths this form does not
 *                              declare, so it belongs to another form. This form keeps no draft:
 *                              saving would replace work nothing could read back. Give each form its
 *                              own key."*
 *
 * The first arrives before anybody has typed, which is the moment a consumer can still act on it.
 *
 * The detection is **foreign paths** — what is in the stored draft that the writing form does not
 * declare. That catches the case where the other form is larger, and cannot catch the case where it
 * is smaller, because a form whose shape contains the other's sees nothing foreign at all:
 *
 *     A declares {a, b}, then B declares {a}      B refuses, reports the code, keeps no draft
 *     A declares {a},    then B declares {a, b}   B overwrites A's draft, and says nothing
 *
 * The same mistake, the same two forms, the same key — and whether anybody is told depends on which
 * of them typed second. A short edit form beside a full one, sharing a key by accident, is the
 * ordinary way to reach the second row: the full form destroys the short one's draft, the short one
 * silently stops keeping a draft at all, and neither person is told.
 *
 * The stamp rule beside it — the newest typing wins — is right for two views of *one* form, which is
 * what a key is documented to identify. What is measured here is that the two rules answer the same
 * event differently depending on a shape.
 *
 * Green when a form that would replace another form's draft is stopped whichever shape it has, or
 * when the one that is stopped is not stopped either.
 */

import { createForm, field, MDY_DRAFT_KEY_IN_USE, MDY_DRAFT_NOT_RESTORED } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SAVED = 800;

function memoryStorage() {
  const written = new Map();
  return {
    written,
    storage: { read: (key) => written.get(key) ?? null, write: (key, value) => written.set(key, value), remove: (key) => written.delete(key) },
  };
}

/**
 * One form writes under the key, then another does. What the storage holds afterwards, and what the
 * second form was told.
 */
async function twoFormsOneKey(shapeOfFirst, shapeOfSecond) {
  const store = memoryStorage();
  const codes = [];
  const options = {
    devWarnings: false,
    draft: { key: "shared", storage: store.storage },
    diagnostics: { report: ({ code }) => codes.push(code) },
  };

  const first = createForm(shapeOfFirst(), options);
  first.f.a.set("the first form's work");
  await new Promise((resolve) => setTimeout(resolve, SAVED));
  const afterFirst = store.written.get("shared");

  const second = createForm(shapeOfSecond(), options);
  second.f.a.set("the second form's work");
  await new Promise((resolve) => setTimeout(resolve, SAVED));
  const afterSecond = store.written.get("shared");

  first.destroy();
  second.destroy();
  return { replaced: afterFirst !== afterSecond, told: [...new Set(codes)], afterFirst, afterSecond };
}

battle(
  {
    claims: ["PER-004", "PER-001"],
    title: "a form that would replace another form's draft is stopped whichever shape it has",
    environments: ["node"],
  },
  async (ctx) => {
    const small = () => ({ a: field("") });
    const large = () => ({ a: field(""), b: field("") });

    // The control, and the direction the guard was built for: the second form declares less than the
    // draft holds, so the draft is visibly not its own.
    const secondIsSmaller = await twoFormsOneKey(large, small);
    ctx.log.note("the second form declares less than the draft holds", secondIsSmaller);
    // Two codes, and the order is the substance rather than an implementation detail: the form
    // declines to *restore* another form's draft when it opens, and declines to *write* over it when
    // it would save. The first arrives before anybody has typed, which is the moment a consumer can
    // still do something about it — so it is not noise to be suppressed because the second is coming.
    //
    // Held as an exact ordered list rather than a `contains`, because a third code appearing here
    // would be a form saying something nobody decided it should say, and that is worth failing on.
    expectEqual(
      [secondIsSmaller.replaced, secondIsSmaller.told],
      [false, [MDY_DRAFT_NOT_RESTORED, MDY_DRAFT_KEY_IN_USE]],
      {
        claimIds: ["PER-004"],
        what: "a form did not refuse a draft holding paths it does not declare, so the protection this battle is about is not there at all",
      },
    );

    // The same mistake, the other way round. Nothing about the situation has changed except which
    // form typed second.
    const secondIsLarger = await twoFormsOneKey(small, large);
    ctx.log.note("the second form declares everything the draft holds, and more", secondIsLarger);

    expectClaim(!secondIsLarger.replaced || secondIsLarger.told.includes(MDY_DRAFT_KEY_IN_USE), {
      claimIds: ["PER-004", "PER-001"],
      what: "a form replaced another form's draft without being stopped or reported, because its own shape happened to contain the other's",
      detail: JSON.stringify(secondIsLarger),
    });
  },
);
