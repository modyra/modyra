/**
 * A declaration changed after the element is on the page reaches the projection.
 *
 * The projection is a memoized computed owned by the reactivity that owns the field handle. A
 * declaration this element holds as a Lit reactive property — the words under a control, which clock
 * a timepicker wears — is invisible to that runtime, so writing it invalidates nothing and the
 * projection keeps answering with whatever it was given when it last ran.
 *
 * **The defect hid behind a coincidence.** Read statically, two components wiring the same option the
 * same way looked identical, and one of them worked: something else in its settle happened to touch a
 * signal and the projection recomputed for an unrelated reason. It is `a-derivation-agreed-not-verified`
 * on the time axis rather than the data axis — two paths that coincide until you put them in the same
 * run — and only a sequence could tell them apart:
 *
 *     at rest                    names the errors
 *     after setting the words    names the errors        <- nothing moved it
 *     after any value change     names the errors and the description
 *
 * So this asserts the middle line, on two different declarations, because a rule proved on one option
 * is a rule proved on one option.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { installDomGlobals } from "./support/dom-env.mjs";
installDomGlobals();
const fx = await import("./support/state-fixture.mjs");

test("the words under a control arrive without anything else moving", async () => {
  const fixture = await fx.mount("radio");
  const element = fixture.root;
  const describedBy = () =>
    element.fieldController?.view?.()?.parts?.group?.attributes?.["aria-describedby"] ?? "";

  const before = describedBy();
  element.supportingText = "Serve un aiuto qui";
  await fixture.settle?.();

  assert.notEqual(describedBy(), before,
    "the declaration was written, the element re-rendered, and the projection still answers what it "
    + "was told before it: nothing invalidated the computed that reads it");
  fixture.dispose?.();
});

test("the clock a timepicker wears arrives without anything else moving", async () => {
  // The second option, so the rule is proved for the class rather than for one member of it: the
  // same mechanism was deduced here and never measured until this asserted it.
  const fixture = await fx.mount("timepicker");
  const element = fixture.root;
  const highestHour = () =>
    element.fieldController?.view?.()?.parts?.hourControl?.attributes?.["aria-valuemax"] ?? null;

  const before = highestHour();
  element.format = element.format === "24h" ? "12h" : "24h";
  await fixture.settle?.();

  assert.notEqual(highestHour(), before,
    `the clock was changed and the hour still reports a maximum of ${String(before)}`);
  fixture.dispose?.();
});
