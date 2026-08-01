/**
 * The state matrix, driven against the Lit elements.
 *
 * Same judgement as every other adapter — `collectStateMatrix` from `@modyra/widgets/testing` — with
 * only the driving elsewhere: `support/state-fixture.mjs`, where the equivalence suite reaches for
 * it too. Both ask what this element looks like in a state, and a fixture each is two answers that
 * can drift.
 *
 * Until this existed, a state defect in Lit was invisible: the matrix ran on Plain alone, so
 * `readonly` could be fixed there and stay broken here with a green board.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { collectStateMatrix, normalizeStateLedger } = await import("../../widgets/dist/testing/index.js");
const { explainValueMismatch } = await import("../../core/dist/index.js");
const { KINDS, emptyFor, mount, valueFor } = await import("./support/state-fixture.mjs");

/**
 * Lit's divergences from the state contract, recorded rather than waived. Asserted both ways: a new
 * divergence fails, and so does an entry left behind after its fix.
 */
const KNOWN_DIVERGENCES = {};

const matrix = await collectStateMatrix({ kinds: KINDS, mount });

test("every declared state of every Lit element is asserted", () => {
  console.log(matrix.report("lit, every kind"));
  assert.equal(
    matrix.asserted + matrix.undrivable.length,
    matrix.expected,
    "a kind × state pair was silently skipped",
  );
});

test("lit's divergences are exactly the recorded ones", () => {
  assert.deepEqual(matrix.observed, normalizeStateLedger(KNOWN_DIVERGENCES));
});

test("no Lit element exposes ARIA for a state it does not declare", () => {
  assert.deepEqual(matrix.unsupportedAria, []);
});

/**
 * The values this fixture drives with are the values the contract says the kind holds.
 *
 * A driver that hands the wrong shape produces a green row about a state the widget was never in:
 * `daterange` once received `""` from a fixture that used one empty value for every kind, and
 * nothing noticed. The kind declares its shape; this is where the fixture answers to it.
 */
test("the fixture drives each kind with a value of its declared shape", () => {
  for (const kind of KINDS) {
    assert.equal(explainValueMismatch(kind, emptyFor(kind)), null, `${kind}: empty`);
    assert.equal(explainValueMismatch(kind, valueFor(kind)), null, `${kind}: filled`);
  }
});

/**
 * Escape closes an open overlay — the transition the contract declares, replayed against the DOM.
 *
 * The matrix proves the widget looks right in a state it was put into; this proves it *gets* there.
 * A renderer whose Escape handler is bound where focus never lands passes every other check here.
 */
const { MDY_WIDGET_TRANSITIONS } = await import("../../widgets/dist/index.js");

test("Escape closes an open overlay, on every kind that declares the transition", async () => {
  const closable = KINDS.filter((kind) =>
    MDY_WIDGET_TRANSITIONS[kind].some(
      (t) => t.from === "open" && t.trigger.type === "key" && t.trigger.key === "Escape",
    ),
  );
  assert.ok(closable.length > 0, "no kind declares Escape");

  for (const kind of closable) {
    const fixture = await mount(kind);
    try {
      if (!fixture.drive("open")) continue;
      await fixture.settle();
      const popup = fixture.parts().popup;
      assert.ok(popup, `${kind}: no popup after opening`);
      // `aria-expanded` on the opener is the contract's own statement of open-ness, and the signal
      // every adapter carries. Asserting it rather than the popup's visibility holds all three to
      // the same claim.
      const openerEl = fixture.root.querySelector("[aria-expanded]");
      assert.equal(openerEl?.getAttribute("aria-expanded"), "true", `${kind}: the opener did not open it`);

      // Where the user actually is: an overlay that takes focus handles Escape inside itself, one
      // that leaves focus on the opener handles it there.
      const target = document.activeElement && fixture.root.contains(document.activeElement)
        ? document.activeElement
        : fixture.root.querySelector(
            ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle, .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
          );
      target.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await fixture.settle();

      assert.equal(popup.hidden, true, `${kind}: Escape left the popup showing`);
      assert.equal(openerEl?.getAttribute("aria-expanded"), "false", `${kind}: Escape did not close the overlay`);
    } finally {
      fixture.dispose();
    }
  }
});
