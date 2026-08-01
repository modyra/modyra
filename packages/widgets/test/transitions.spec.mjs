/**
 * The declared transitions, against the implementation every adapter routes through.
 *
 * `overlayLifecycleTransition` is called by all three renderers, so holding it to the table holds the
 * renderers to it. `widgetKeyIntent` is held to the table as well, but nothing consumes that one:
 * each renderer writes its own key handling, so the agreement here is between the contract and a
 * function, not yet between the contract and what a user's keyboard does.
 *
 * The table is written independently rather than derived from these functions — a declaration read
 * out of the implementation it checks is not a check.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_TRANSITIONS,
  overlayLifecycleTransition,
  transitionsFrom,
  widgetKeyIntent,
  MDY_WIDGET_KEYBOARD,
  keyBindingFor,
} from "../dist/index.js";

const KINDS = Object.keys(MDY_WIDGET_CONTRACTS);
const OVERLAY_KINDS = KINDS.filter((kind) => MDY_WIDGET_CONTRACTS[kind].capabilities.overlay);

test("exactly the overlay kinds declare transitions", () => {
  for (const kind of KINDS) {
    const declared = MDY_WIDGET_TRANSITIONS[kind].length > 0;
    assert.equal(
      declared,
      OVERLAY_KINDS.includes(kind),
      `${kind}: declares ${MDY_WIDGET_TRANSITIONS[kind].length} transitions`,
    );
  }
});

test("the opener toggles: it opens a closed overlay and closes an open one", () => {
  for (const kind of OVERLAY_KINDS) {
    for (const from of ["closed", "open"]) {
      const declared = transitionsFrom(kind, from).find((t) => t.trigger.type === "pointer");
      assert.ok(declared, `${kind}: no pointer transition from ${from}`);

      const actual = overlayLifecycleTransition(
        { open: from === "open" },
        { type: "toggle", disabled: false, available: true },
      );
      assert.equal(
        actual.state.open ? "open" : "closed",
        declared.to,
        `${kind}: toggling from ${from} disagrees with the contract`,
      );
    }
  }
});

test("Escape closes an open overlay and restores focus, on every kind that has one", () => {
  for (const kind of OVERLAY_KINDS) {
    const declared = transitionsFrom(kind, "open").find(
      (t) => t.trigger.type === "key" && t.trigger.key === "Escape",
    );
    assert.ok(declared, `${kind}: Escape is not declared`);
    assert.equal(declared.restoresFocus, true);

    // The key handler names the intent...
    const intent = widgetKeyIntent(kind, "Escape", true);
    assert.deepEqual(intent, { type: "cancel", restoreFocus: true }, `${kind}: Escape intent`);

    // ...and the lifecycle carries it out.
    const actual = overlayLifecycleTransition({ open: true }, { type: "escape" });
    assert.equal(actual.state.open, false, `${kind}: Escape did not close`);
    assert.equal(actual.restoreFocus, true, `${kind}: Escape did not restore focus`);
  }
});

test("Escape does nothing to a closed overlay", () => {
  for (const kind of OVERLAY_KINDS) {
    assert.equal(widgetKeyIntent(kind, "Escape", false), null, `${kind}: Escape while closed`);
  }
});

test("an outside pointer dismisses exactly the kinds that declare it", () => {
  for (const kind of OVERLAY_KINDS) {
    const declared = transitionsFrom(kind, "open").some((t) => t.trigger.type === "outside");
    assert.equal(
      declared,
      MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnOutsidePointer,
      `${kind}: outside-dismissal disagrees with the capability`,
    );
    if (!declared) continue;

    const actual = overlayLifecycleTransition({ open: true }, { type: "outside", outside: true });
    assert.equal(actual.state.open, false, `${kind}: an outside pointer did not close it`);
    // Deliberately not focus-restoring: the user moved their own attention.
    assert.equal(actual.restoreFocus, false, `${kind}: an outside pointer pulled focus back`);
  }
});

test("a disabled widget does not transition", () => {
  const actual = overlayLifecycleTransition(
    { open: false },
    { type: "toggle", disabled: true, available: true },
  );
  assert.equal(actual.state.open, false);
  assert.equal(actual.effect, "none");
});

/* ── The keyboard, per kind ─────────────────────────────────────────────────────
 * `widgetKeyIntent` answered without asking which widget it was looking at. These hold it to the
 * declaration, and the first three are the answers it used to get wrong.
 */
test("a kind claims only the keys it can act on", () => {
  // A free-text field has no options to walk and no overlay to open: the native control owns its
  // keyboard entirely, and the widget layer must not claim keys out from under it.
  for (const kind of ["text", "email", "password", "textarea", "file"]) {
    assert.equal(MDY_WIDGET_KEYBOARD[kind].length, 0, `${kind} claims keys`);
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Home", "End"]) {
      assert.equal(widgetKeyIntent(kind, key, false), null, `${kind} claimed ${key}`);
    }
  }
});

test("a range steps on the arrows rather than walking a list", () => {
  for (const kind of ["number", "slider"]) {
    assert.deepEqual(widgetKeyIntent(kind, "ArrowUp", false), { type: "increment" }, kind);
    assert.deepEqual(widgetKeyIntent(kind, "ArrowDown", false), { type: "decrement" }, kind);
  }
});

test("the declaration and the intent function agree, for every kind and key", () => {
  const KEYS = ["Escape", "ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Tab", "q"];
  for (const kind of KINDS) {
    for (const key of KEYS) {
      for (const open of [false, true]) {
        const declared = keyBindingFor(kind, key, open);
        const actual = widgetKeyIntent(kind, key, open);
        assert.equal(
          declared === null,
          actual === null,
          `${kind} × ${key} × open=${open}: declaration says ${declared?.intent ?? "nothing"}, function says ${actual?.type ?? "nothing"}`,
        );
      }
    }
  }
});
