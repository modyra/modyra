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
  MDY_POPUP_OPENERS,
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

test("the opener toggles, unless it is the control the user types into", () => {
  // Named, not read off the catalogue — see the `typeable` test below for why.
  const CLOSES_ON_ITS_OPENER = ["select", "multiselect", "daterange", "colors"];
  for (const kind of OVERLAY_KINDS) {
    const typeable = !CLOSES_ON_ITS_OPENER.includes(kind);
    for (const from of ["closed", "open"]) {
      const declared = transitionsFrom(kind, from).find((t) => t.trigger.type === "pointer");

      // A press in a text field places the caret. Closing the calendar in answer takes the field
      // away at the moment the user reached for it, so the kinds whose opener is their control
      // declare no pointer transition out of `open` — the toggle button beside it is the switch.
      if (from === "open" && typeable) {
        assert.equal(declared, undefined, `${kind}: a typeable opener must not close on a pointer`);
        continue;
      }

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

/**
 * Every opener opens. Only the ones that are not text fields also close.
 *
 * Stated separately because the rule above now has an exception, and an exception is exactly where a
 * table stops being checked: without this, declaring every opener typeable would leave the suite
 * green on a contract where no pointer opened anything.
 */
test("a pointer on the opener opens a closed overlay, on every kind", () => {
  for (const kind of OVERLAY_KINDS) {
    const declared = transitionsFrom(kind, "closed").find((t) => t.trigger.type === "pointer");
    assert.ok(declared, `${kind}: nothing opens it with a pointer`);
    assert.equal(declared.trigger.part, MDY_POPUP_OPENERS[kind].opener, kind);
    assert.equal(declared.to, "open", kind);
  }
});

/**
 * `typeable` is pinned to the anatomy, not taken on trust.
 *
 * Everything below reads `typeable` to decide what to expect, so on its own none of it can catch the
 * flag being *wrong*: marking every opener typeable satisfied the whole suite, because each
 * expectation moved with the declaration. A rule derived from the data it is checking is not a check
 * — the same thing this file's own header says about the transition table.
 *
 * So it is tied to something independent. `control` is the part that holds the field's typed value —
 * the one a `label[for]` names and the user edits — and the kinds whose opener *is* that part are
 * exactly the kinds where a press is a caret and a space is a space. A future kind that opens from
 * some other text field is a deliberate change to this line, not a silent one.
 */
test("a kind is typeable exactly when its opener is the field's own control", () => {
  for (const kind of OVERLAY_KINDS) {
    const opener = MDY_POPUP_OPENERS[kind];
    assert.equal(
      opener.typeable === true,
      opener.opener === "control",
      `${kind}: opener is "${opener.opener}" but typeable is ${opener.typeable === true}`,
    );
  }
});

/**
 * Space opens the kinds whose opener is a button, and is left to the text field on the others.
 *
 * The keyboard policy has opened on Space for as long as it has existed while this table claimed the
 * key for nothing — the same disagreement Tab had. A widget that opened its calendar on the space
 * bar could not accept "12 March".
 */
test("Space opens an overlay unless its opener is typed into", () => {
  // Named rather than derived, for the reason above: this is the list the behaviour is asserted
  // against, so it has to be able to disagree with the catalogue.
  const OPENS_ON_SPACE = ["select", "multiselect", "daterange", "colors"];
  const LEAVES_SPACE_ALONE = ["datepicker", "timepicker"];
  assert.deepEqual(
    [...OPENS_ON_SPACE, ...LEAVES_SPACE_ALONE].sort(),
    [...OVERLAY_KINDS].sort(),
    "every overlay kind must appear in exactly one of the two lists",
  );

  for (const kind of OPENS_ON_SPACE) {
    assert.deepEqual(widgetKeyIntent(kind, " ", false), { type: "open" }, `${kind}: Space should open`);
  }
  for (const kind of LEAVES_SPACE_ALONE) {
    assert.equal(widgetKeyIntent(kind, " ", false), null, `${kind}: Space belongs to the text field`);
  }
  // Space never claims an open overlay: what it does there belongs to whatever has focus inside.
  for (const kind of OVERLAY_KINDS) {
    assert.equal(widgetKeyIntent(kind, " ", true), null, `${kind}: Space while open`);
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
