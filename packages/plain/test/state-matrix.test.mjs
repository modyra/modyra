/**
 * The state matrix, driven against the Plain renderer.
 *
 * The traversal, the report and the divergence bookkeeping are shared — `collectStateMatrix` in
 * `@modyra/widgets/testing`. The driving is this renderer's own and lives in
 * `support/state-fixture.mjs`, where the equivalence suite reaches for it too: both ask what this
 * widget looks like in a state, and a fixture each is two answers that can drift.
 *
 * That split was the design from the start and went unused for a while, which is how a defect fixed
 * in one adapter and still live in the others passed for closed.
 *
 * Divergences are recorded, not fixed, unless a batch says otherwise. The ledger is asserted both
 * ways: a new divergence fails, and so does a stale entry that outlived its fix.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { collectStateMatrix, normalizeStateLedger } = await import("../../widgets/dist/testing/index.js");
const { explainValueMismatch } = await import("../../core/dist/index.js");
const { KINDS, emptyFor, mount, valueFor } = await import("./support/state-fixture.mjs");

/**
 * Plain's divergences: **no rendering defects left**.
 *
 * The ledger is asserted both ways, so it is a live claim rather than a comment — a new divergence
 * fails here, and so does a stale entry left behind after its fix.
 *
 * What batch D closed, in the order the causes turned out to nest:
 *
 * - select, datepicker and timepicker emitted `aria-disabled` and left the control operable. The
 *   native attribute now goes out with the ARIA.
 * - the multiselect renders its options twice and only the popup's grid applied the contract part,
 *   so a disabled multiselect left two live buttons in the field.
 * - `daterange`, `colors` and `file` had **no a11y projection at all**. No controller in
 *   `@modyra/widgets` builds one, so those three applied the static part contract and nothing
 *   state-driven. The six rows understated it: there was no `aria-required` and no
 *   `aria-describedby` either, so their error lists were rendered, styled, and announced to nobody.
 *   `projectFieldShellA11y` is the shared half of `projectTextFieldA11y` for exactly this case.
 *
 * Empty, and the reason it stays that way: a divergence that every adapter shows identically is a
 * validation finding, not a renderer one. An unchecked required checkbox, an off required toggle and
 * a required range with both ends unset are all cases where the renderer tells the truth about a
 * state the form never enters. `required` treats `false` and an empty range as empty, and a
 * *partial* range is rejected by `completeRange` whether or not the field is required.
 */
const KNOWN_DIVERGENCES = {};

const matrix = await collectStateMatrix({ kinds: KINDS, mount });

test("every declared state of every kind is asserted", () => {
  console.log(matrix.report("plain, every kind"));
  assert.equal(
    matrix.asserted + matrix.undrivable.length,
    matrix.expected,
    "a kind × state pair was silently skipped",
  );
});

test("plain's divergences are exactly the recorded ones", () => {
  assert.deepEqual(matrix.observed, normalizeStateLedger(KNOWN_DIVERGENCES));
});

test("no kind exposes ARIA for a state it does not declare", () => {
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
 * The state matrix proves the widget *looks* right in a state it was put into. This proves the
 * widget *gets* there: the user presses a key and the overlay goes away. A renderer whose Escape
 * handler was never wired passes every other check in this file.
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
    const fixture = mount(kind);
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

      // Where the user actually is. An overlay that moves focus into itself handles Escape there;
      // one that leaves focus on the opener handles it there. Dispatching at a guessed element
      // tests the fixture's guess rather than the widget.
      const target = document.activeElement && fixture.root.contains(document.activeElement)
        ? document.activeElement
        : (popup.contains(document.activeElement) ? document.activeElement : null)
          ?? fixture.root.querySelector(
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

test("out of play, no verdict: the wrapper and the error text go with it", async () => {
  // What the widgets contract decides, painted: a field the form is not asking about carries neither
  // the error modifier nor the message. The rule is one line in `@modyra/widgets`; this is the half
  // that reaches a screen.
  const { mountMdyForm } = await import("../dist/index.js");
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(
    host,
    [{ name: "a", kind: "text", label: "A", validators: { required: true } }],
    { submitLabel: null },
  );
  const wrapper = () => host.querySelector(".mdy-input-wrapper")?.className ?? "";
  const errorText = () => host.querySelector("[class*=error]")?.textContent?.trim() ?? "";

  assert.ok(wrapper().includes("mdy-input-wrapper--error"), `enabled and empty: ${wrapper()}`);
  assert.equal(host.querySelector("input")?.getAttribute("aria-invalid"), "true");

  form.setDisabled("a", () => true);
  await reactivity.flush();
  assert.ok(!wrapper().includes("mdy-input-wrapper--error"), `out of play: ${wrapper()}`);
  assert.ok(wrapper().includes("mdy-input-wrapper--disabled"), "and it still says it is disabled");
  assert.equal(host.querySelector("input")?.getAttribute("aria-invalid"), "false");
  assert.equal(errorText(), "", "the message stayed on screen");

  form.setDisabled("a", () => false);
  await reactivity.flush();
  assert.ok(wrapper().includes("mdy-input-wrapper--error"), "the verdict did not come back");

  dispose();
  host.remove();
});
