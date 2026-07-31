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
const { createLitForm, field, required } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { collectStateMatrix, normalizeStateLedger } = await import("../../widgets/dist/testing/index.js");

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
    case "file": return null;
    default: return "value";
  }
}

/** The empty value each kind accepts. A multiselect handed "" throws rather than emptying. */
function emptyFor(kind) {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": case "slider": return null;
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
      return { ...shell, trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), popup: q(".mdy-select__dropdown"), listbox: q(".mdy-select__list") };
    case "multiselect":
      return { ...shell, inputWrapper: q(".mdy-multiselect"), popup: q(".mdy-multiselect__dropdown") };
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
  const form = createLitForm({ value: field(initial, [required()]) });
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
        case "loading": return false;
        default: return false;
      }
    },
  };
}

/**
 * Lit's divergences from the state contract, recorded rather than waived. This ledger is new — the
 * matrix has never run against Lit before — so its first contents are a measurement, not a
 * regression. Asserted both ways.
 */
const KNOWN_DIVERGENCES = {
  // Lit never emits `aria-disabled`. It binds `?disabled` and takes only three attributes from the
  // a11y projection — aria-invalid, aria-required, aria-describedby — so the native attribute lands
  // and the ARIA never does. One gap, seen once per kind. `radio` and `select` escape it because
  // they build their own ARIA.
  "text × disabled": ["STATE_ARIA_MISSING"],
  "email × disabled": ["STATE_ARIA_MISSING"],
  "password × disabled": ["STATE_ARIA_MISSING"],
  "textarea × disabled": ["STATE_ARIA_MISSING"],
  "number × disabled": ["STATE_ARIA_MISSING"],
  "slider × disabled": ["STATE_ARIA_MISSING"],
  "checkbox × disabled": ["STATE_ARIA_MISSING"],
  "toggle × disabled": ["STATE_ARIA_MISSING"],
  "segmented × disabled": ["STATE_ARIA_MISSING"],
  "multiselect × disabled": ["STATE_ARIA_MISSING"],
  "datepicker × disabled": ["STATE_ARIA_MISSING"],
  "daterange × disabled": ["STATE_ARIA_MISSING"],
  "timepicker × disabled": ["STATE_ARIA_MISSING"],
  "colors × disabled": ["STATE_ARIA_MISSING"],
  "file × disabled": ["STATE_ARIA_MISSING"],

  // `invalid` is unreachable on the kinds whose empty value is not "" — a checkbox at false, a
  // slider at null, a range with both ends unset. Whether `required` should reject those at all is
  // a validation question, so they are held rather than guessed at.
  "checkbox × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "toggle × invalid": ["STATE_ARIA_MISSING", "STATE_PART_MISSING"],
  "daterange × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "slider × invalid": ["STATE_ARIA_MISSING"],
  "segmented × invalid": ["STATE_ARIA_MISSING"],
  "colors × invalid": ["STATE_ARIA_MISSING"],

  // The multiselect popup does not open from the search button in this fixture.
  "multiselect × open": ["STATE_ARIA_MISSING"],
};

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
