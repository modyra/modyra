/**
 * The state matrix, driven against the Lit elements.
 *
 * Same judgement as Plain and Angular — `collectStateMatrix` from `@modyra/widgets/testing` — with
 * only the driving here. Until this existed, a state defect in Lit was invisible: the matrix ran on
 * Plain alone, so `readonly` could be fixed there and stay broken here with a green board.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount as mountElement } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, required, min } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { collectStateMatrix, normalizeStateLedger } = await import("../../widgets/dist/testing/index.js");
const { explainValueMismatch } = await import("../../core/dist/index.js");

defineMdyElements();

const option = { value: "a", label: "A" };

/** The elements this package defines, and the kind each answers to. */
const ELEMENTS = [
  ["mdy-text-field", "text", ""],
  ["mdy-text-field", "email", ""],
  ["mdy-text-field", "password", ""],
  ["mdy-textarea-field", "textarea", ""],
  ["mdy-number-field", "number", 0],
  ["mdy-slider-field", "slider", 0],
  ["mdy-checkbox-field", "checkbox", false],
  ["mdy-toggle-field", "toggle", false],
  ["mdy-radio-group-field", "radio", null],
  ["mdy-segmented-field", "segmented", null],
  ["mdy-select-field", "select", null],
  ["mdy-multiselect-field", "multiselect", []],
  ["mdy-datepicker-field", "datepicker", null],
  ["mdy-daterange-field", "daterange", null],
  ["mdy-timepicker-field", "timepicker", null],
  ["mdy-colors-field", "colors", null],
  ["mdy-file-field", "file", null],
];
const KINDS = ELEMENTS.map(([, kind]) => kind);
const TAG_FOR = new Map(ELEMENTS.map(([tag, kind, initial]) => [kind, { tag, initial }]));

function valueFor(kind) {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    case "multiselect": return ["a"];
    case "radio": case "segmented": case "select": return "a";
    case "datepicker": return "2026-07-15";
    case "daterange": return { start: "2026-07-15", end: "2026-07-20" };
    case "timepicker": return "10:30";
    case "colors": return "#004cff";
    case "file": return [new File(["content"], "report.txt", { type: "text/plain" })];
    default: return "value";
  }
}

/** The empty value each kind accepts. A multiselect handed "" throws rather than emptying. */
function emptyFor(kind) {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": return null;
    case "file": return [];
    // A slider is never empty: its thumb is somewhere, and that somewhere is its minimum. Driving
    // `null` asked the renderer for a state the kind cannot be in.
    case "slider": return 0;
    case "daterange": return { start: null, end: null };
    default: return "";
  }
}

function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}

function partsOf(root, kind) {
  const q = (selector) => root.querySelector(selector);
  const shell = {
    label: q(".mdy-label, .mdy-toggle__label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle"),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
  switch (kind) {
    case "checkbox":
      return { ...shell, control: q('input[type="checkbox"]'), indicator: q(".mdy-checkbox__indicator") };
    case "toggle":
      return { ...shell, control: q('input[type="checkbox"]'), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "radio":
      return { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    case "segmented":
      return { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") };
    case "select":
      return { ...shell, loading: q(".mdy-select__loader"), trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), popup: q(".mdy-select__dropdown"), listbox: q(".mdy-select__list") };
    case "multiselect":
      return {
        ...shell,
        inputWrapper: q(".mdy-multiselect"),
        loading: q(".mdy-select__loader"),
        // The opener the contract names. Without it the inspector cannot see the relation the
        // button carries, and reports the state as unexposed.
        searchButton: q(".mdy-multiselect__search-btn"),
        popup: q(".mdy-multiselect__dropdown"),
      };
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup") };
    case "daterange": {
      const inputs = root.querySelectorAll(".mdy-daterange__input");
      return { ...shell, startControl: inputs[0] ?? null, endControl: inputs[1] ?? null, toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup") };
    }
    case "timepicker":
      return { ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: q(".mdy-timepicker__popup") };
    case "colors":
      return { ...shell, control: q(".mdy-colors__native-hidden"), toggle: q(".mdy-colors__toggle-area"), popup: q(".mdy-colors__dropdown") };
    case "file":
      return { ...shell, inputWrapper: null, dropzone: q(".mdy-file-container"), control: q(".mdy-file-input") };
    default:
      return { ...shell, control: controlOf(root) };
  }
}

async function mount(kind) {
  const { tag, initial } = TAG_FOR.get(kind);
  // Required, so the `invalid` state is reachable at all. Without a validator the field can never
  // be invalid and every `invalid` row reads as a renderer divergence when it is a fixture gap.
  // A slider is never empty, so `required` alone can never fail on one and its `invalid` row would
  // be green because the state is unreachable rather than because the renderer is right.
  const validators = kind === "slider" ? [required(), min(1)] : [required()];
  const form = createLitForm({ value: field(initial, validators) });
  const element = await mountElement(tag, (el) => {
    el.field = form.f.value;
    el.label = "Label";
    if (kind === "email" || kind === "password") el.type = kind;
    if (kind === "radio" || kind === "segmented" || kind === "select" || kind === "multiselect") {
      el.options = [option];
    }
  });

  return {
    root: element,
    parts: () => partsOf(element, kind),
    control: () => controlOf(element),
    // Lit batches into its own update cycle, so a signal write outside it needs a task turn before
    // the DOM reflects anything.
    //
    // This deliberately does NOT call `requestUpdate()`. It used to, and that hid a real bug:
    // `MdyFormController` subscribes to a hand-written list of signals, `readonly` was not on it,
    // and Lit therefore never re-rendered when a field was marked read-only. Forcing an update made
    // the attribute appear anyway, so the row passed while the adapter was inert. Whether the
    // element subscribed to the signal that changed is exactly what this matrix is for.
    settle: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await element.updateComplete;
    },
    dispose: () => element.remove(),
    drive(state) {
      const handle = form.f.value;
      switch (state) {
        case "pristine": return true;
        case "empty": handle.set(emptyFor(kind)); return true;
        case "filled": handle.set(valueFor(kind)); return true;
        case "touched": handle.markAsTouched(); return true;
        case "invalid": handle.set(emptyFor(kind)); handle.markAsTouched(); return true;
        case "focused": controlOf(element)?.focus?.(); return true;
        case "selected": handle.set(valueFor(kind)); return true;
        case "disabled": form.setDisabled("value", () => true); return true;
        case "readonly": form.setReadonly("value", () => true); return true;
        case "open": {
          const trigger = element.querySelector(
            ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle, .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
          );
          if (!trigger) return false;
          trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
          return true;
        }
        // A public property on the element, so the state the contract declares is reachable.
        case "loading": element.loading = true; return true;
        default: return false;
      }
    },
  };
}

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
