/**
 * Where a caption names the control, the caption is the name.
 *
 * Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so
 * an `aria-label` beside it is text nobody will ever hear — and where they disagree, the one a
 * developer is reading in the source is the one that does not speak (ADR 0175).
 *
 * These components each wrote that rule out for themselves, and the comment beside the expression
 * said "the name it has where nothing captions it" while the code wrote the name whether or not
 * something did. Six kinds let a declared name silence the caption and two did not, so the same
 * document produced two different behaviours depending on which control it asked for.
 *
 * Both directions are asserted, because a repair that only ever answered "the caption" would have
 * deleted the feature rather than fixed it: a control with no caption still needs a name.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { readAccessibleName } = await import("@modyra/widgets/testing");

/** Every kind this package draws whose control a document can name. */
const KINDS = ["text", "number", "checkbox", "toggle", "slider", "file", "datepicker", "timepicker"];

const nameOf = async (kind, declared) => {
  const fixture = await config.mount(kind, { config: declared });
  await fixture.settle?.();
  const control = fixture.control?.() ?? null;
  assert.ok(control, `${kind}: no control to read a name from`);
  const reading = readAccessibleName(control, "bench", document);
  fixture.dispose?.();
  return reading.value;
};

test("a caption outranks a name the document also declared", async () => {
  for (const kind of KINDS) {
    const { name, mechanism } = await nameOf(kind, { ariaLabel: "Nome dichiarato" });
    assert.deepEqual({ kind, name, mechanism },
      { kind, name: "Given", mechanism: "aria-labelledby" });
  }
});

test("with nothing captioning it, the declared name is the name", async () => {
  for (const kind of KINDS) {
    const { name, mechanism } = await nameOf(kind, { label: "", ariaLabel: "Nome dichiarato" });
    assert.deepEqual({ kind, name, mechanism },
      { kind, name: "Nome dichiarato", mechanism: "aria-label" });
  }
});
