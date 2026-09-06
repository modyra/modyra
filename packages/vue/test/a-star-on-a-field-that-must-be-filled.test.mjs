/**
 * The mark that says a field must be filled, on every kind that declares one.
 *
 * The contract gives all seventeen kinds a `requiredMarker` inside their caption, present when the
 * field is required. A renderer that never draws it leaves a page where a reader is told the field
 * is required — `aria-required` says so — and nobody looking at it can see that. The two are one
 * statement about one field, so they are asserted together.
 *
 * Both states, because only the pair can fail: a renderer that always drew the mark and one that
 * drew it correctly are indistinguishable from the required state alone.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { installDomGlobals } from "./support/dom-env.mjs";
installDomGlobals();

const cfg = await import("../conformance.config.mjs");

test("every kind draws the required mark when it is required, and not when it is not", async () => {
  const wrong = [];
  for (const kind of cfg.kinds) {
    const seen = [];
    for (const required of [true, false]) {
      const fixture = await cfg.mount(kind, required ? {} : { validators: false });
      await fixture.settle?.();
      const found = fixture.parts().requiredMarker;
      seen.push((Array.isArray(found) ? found.length > 0 : found != null) ? 1 : 0);
      fixture.dispose?.();
    }
    if (seen[0] !== 1 || seen[1] !== 0) wrong.push(`${kind}: required=${seen[0]} optional=${seen[1]}`);
  }
  assert.deepEqual(wrong, [], `the mark and the field disagree on:\n  ${wrong.join("\n  ")}`);
});

test("the mark and aria-required describe the same field", async () => {
  const wrong = [];
  for (const kind of cfg.kinds) {
    for (const required of [true, false]) {
      const fixture = await cfg.mount(kind, required ? {} : { validators: false });
      await fixture.settle?.();
      const found = fixture.parts().requiredMarker;
      const marked = (Array.isArray(found) ? found.length > 0 : found != null);
      // Read off the page rather than off the fixture's accessor: a kind whose `control()` answers
      // nothing would otherwise report "no aria-required" and read as a renderer that omits it.
      const announced = fixture.root?.querySelector("[aria-required]")?.getAttribute("aria-required");
      if (announced !== null && announced !== undefined && marked !== (announced === "true")) {
        wrong.push(`${kind}[${required ? "required" : "optional"}]: mark=${marked} aria-required=${announced}`);
      }
      fixture.dispose?.();
    }
  }
  assert.deepEqual(wrong, [], `a star and an announcement that disagree:\n  ${wrong.join("\n  ")}`);
});
