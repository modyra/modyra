/**
 * An opener says what it opens.
 *
 * `aria-haspopup` is announced with the control — "button, has popup listbox" — so a person decides
 * whether to press it from what they were told it is. The promise has one source, the opener relation
 * the catalogue declares per kind, and every opener this renderer draws carries exactly that word.
 * An opener that carries `aria-expanded` and `aria-controls` but no promise is announced as a plain
 * button that happens to toggle something.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_POPUP_OPENERS, projectOverlayOpenerA11y } = await import("@modyra/widgets");

const KINDS = Object.keys(MDY_POPUP_OPENERS).filter((kind) => config.kinds.includes(kind));

test("this config draws kinds that open, or the bench guards nothing", () => {
  assert.ok(KINDS.length > 0);
});

for (const kind of KINDS) {
  test(`${kind}: the opener carries the promise the contract declares`, async () => {
    const relation = MDY_POPUP_OPENERS[kind];
    const promised = projectOverlayOpenerA11y(kind, { widgetId: "w", open: false })?.attributes["aria-haspopup"];
    assert.equal(typeof promised, "string", `${kind} declares an opener with no promise, so there is nothing to hold it to`);

    const fixture = await config.mount(kind, { variant: relation.variant });
    try {
      await fixture.settle?.();
      const opener = fixture.parts()[relation.opener];
      assert.ok(opener && !Array.isArray(opener), `${kind} drew no single ${relation.opener}`);
      assert.equal(opener.getAttribute("aria-haspopup"), promised, `${kind}: the ${relation.opener} does not say what it opens`);
    } finally {
      fixture.dispose?.();
    }
  });
}
