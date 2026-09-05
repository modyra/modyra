import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("@modyra/widgets");
const { MDY_CANONICAL_FILLED, readAccessibleName } = await import("@modyra/widgets/testing");

/**
 * A field holding nothing draws no strip to hold it in.
 *
 * `chips` is declared present when a value is: with nothing chosen there is no strip, not an empty
 * one. Drawn always, it put a `role="grid"` on the page with no rows and no name — and `grid` is one
 * of the three roles the contract says must be named, so an empty container announced itself as a
 * grid that is not about anything.
 *
 * The condition is read from the contract rather than written here: a part whose presence rule moves
 * should move this bench with it.
 */
const strip = (root) => root.querySelector(
  partClasses("multiselect", "chips").map((one) => `.${one}`).join(""),
);

test("the strip is declared present only when a value is", () => {
  const node = MDY_WIDGET_CONTRACTS.multiselect.structure.nodes.find((one) => one.part === "chips");
  assert.equal(node?.presentWhen, "valueIsPresent");
});

test("a multiselect holding nothing draws no strip", async () => {
  const fixture = await config.mount("multiselect", {});
  await fixture.settle?.();
  assert.equal(strip(fixture.root), null);
  fixture.dispose?.();
});

test("a multiselect holding something draws one, and it is named", async () => {
  const fixture = await config.mount("multiselect", { value: MDY_CANONICAL_FILLED.multiselect });
  await fixture.settle?.();
  const drawn = strip(fixture.root);
  assert.ok(drawn, "a field holding a value drew no strip to show it in");
  // Both halves: absent when empty is only right if it is present *and* named when full — a renderer
  // that drew none in either state would pass the first assertion alone.
  assert.notEqual(readAccessibleName(drawn, "bench", document).value.name, "");
  fixture.dispose?.();
});
