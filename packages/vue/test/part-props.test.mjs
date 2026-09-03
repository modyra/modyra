/**
 * A contract part, translated into props without losing or inventing anything.
 *
 * Every component in this package draws through this function, so what it drops is dropped from every
 * widget at once. The two cases below are the ones that were wrong somewhere else first: a `null`
 * attribute is the contract saying *no attribute* and must not reach the page as the word "null", and
 * a caller's own class means "this as well" rather than "this instead" — a part whose classes were
 * replaced by a caller's would leave a widget the themes cannot find.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { partProps } = await import("../dist/index.js");

test("a null attribute is left off rather than written as a value", () => {
  const props = partProps({ classes: [], attributes: { "aria-readonly": null, "aria-required": "false" } });

  assert.equal("aria-readonly" in props, false, "the contract said no attribute and the props carry one");
  assert.equal(props["aria-required"], "false", "an attribute that is present was dropped with the absent one");
});

test("the part's classes survive a caller adding its own", () => {
  const props = partProps({ classes: ["mdy-checkbox__control"], attributes: {} }, { class: "extra" });

  assert.ok(String(props.class).includes("mdy-checkbox__control"), "the caller's class replaced the part's, so a theme can no longer find it");
  assert.ok(String(props.class).includes("extra"), "the caller's class was dropped");
});

test("an absent part yields the caller's own props and nothing invented", () => {
  // A projection does not answer for every part of every kind, and a component drawing an optional
  // part must not be handed an id or a role that no declaration produced.
  const props = partProps(undefined, { class: "only-mine" });

  assert.deepEqual(Object.keys(props).sort(), ["class"], `props were invented for a part that does not exist: ${Object.keys(props).join(" ")}`);
});
