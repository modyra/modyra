import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, partClasses } = await import("@modyra/widgets");

/**
 * A kind that declares a second way in honours it.
 *
 * `MDY_POPUP_OPENERS` names one opener that carries the ARIA — `aria-expanded`, `aria-controls` —
 * and, for some kinds, an `alsoOpensFrom`: a part a pointer may press to the same effect. The second
 * door deliberately carries no relation of its own (ADR 0177), because a second element claiming
 * them would announce two comboboxes for one list.
 *
 * That decision is right and it has a cost: **every check shaped like a keyboard or an attribute is
 * blind to this door by construction.** The only question that reaches it is a pointer press, and
 * nothing was asking it — which is how one renderer came to draw the element and wire nothing to it
 * while three others opened from it.
 *
 * The press lands on the part itself, not on what it contains: pressing a chip inside the box takes
 * or moves that value, and must not also open the panel.
 */
const KINDS = Object.entries(MDY_POPUP_OPENERS)
  .filter(([kind, opener]) => opener?.alsoOpensFrom !== undefined && config.kinds.includes(kind));

test("some kind declares a second door, or this bench guards nothing", () => {
  assert.ok(KINDS.length > 0, "no kind in this config declares alsoOpensFrom");
});

for (const [kind, opener] of KINDS) {
  test(`${kind}: pressing the ${opener.alsoOpensFrom} opens the panel`, async () => {
    const fixture = await config.mount(kind, { value: undefined });
    await fixture.settle?.();

    const selector = partClasses(kind, opener.alsoOpensFrom).map((one) => `.${one}`).join("");
    const second = fixture.root.querySelector(selector);
    assert.ok(second, `${kind}: the contract's second door is not drawn`);

    const main = fixture.root.querySelector(
      partClasses(kind, opener.opener).map((one) => `.${one}`).join(""),
    );
    assert.ok(main, `${kind}: no opener to read the state from`);
    assert.equal(main.getAttribute("aria-expanded"), "false", `${kind}: not closed to begin with`);

    second.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();

    assert.equal(main.getAttribute("aria-expanded"), "true");
    fixture.dispose?.();
  });
}

test("multiselect: pressing a chip inside the box does not open the panel", async () => {
  const fixture = await config.mount("multiselect", { value: ["a"] });
  await fixture.settle?.();
  const chip = fixture.root.querySelector(`.${partClasses("multiselect", "chip").join(".")}`);
  const main = fixture.root.querySelector(
    partClasses("multiselect", MDY_POPUP_OPENERS.multiselect.opener).map((one) => `.${one}`).join(""),
  );
  // The half that a one-sided repair gets wrong: wiring the container without asking where the press
  // landed opens the panel every time somebody takes a value off.
  assert.ok(chip, "no chip to press");
  chip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();
  assert.equal(main?.getAttribute("aria-expanded"), "false");
  fixture.dispose?.();
});
