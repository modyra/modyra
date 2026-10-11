import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_CANONICAL_FILLED } = await import("@modyra/widgets/testing");

/**
 * A date field submits the date it holds, whoever set it.
 *
 * The value travels in a hidden input written after the field renders. A value set from outside the
 * field — by the form, a reset, a program — reaches that input only if the field re-renders for it,
 * so this sets it from outside and reads what a native submit would carry, rather than typing into
 * the field and reading back what the typing wrote.
 */
const sent = (root) =>
  [...root.querySelectorAll('input[type="hidden"][name="value"]')]
    .filter((one) => !one.disabled)
    .map((one) => one.value);

test("datepicker: a value set from outside is the value a native submit carries", async () => {
  const fixture = await config.mount("datepicker");
  await fixture.settle();
  assert.deepEqual(sent(fixture.root), [], "an empty field sends nothing");

  fixture.hold(MDY_CANONICAL_FILLED.datepicker);
  await fixture.settle();
  assert.deepEqual(sent(fixture.root), [MDY_CANONICAL_FILLED.datepicker]);

  fixture.hold("2031-12-24");
  await fixture.settle();
  assert.deepEqual(sent(fixture.root), ["2031-12-24"], "a second outside value replaces the first");

  fixture.drive("disabled");
  await fixture.settle();
  assert.deepEqual(sent(fixture.root), [], "a field switched off from outside leaves the payload");
  fixture.dispose?.();
});
