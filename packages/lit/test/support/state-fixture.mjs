/**
 * One element of a kind, mounted and drivable — the Lit renderer's answer to `MdyStateFixture`.
 *
 * Both suites that observe a widget in a state mount it through here: the state matrix, which asks
 * whether this renderer is right, and the equivalence suite, which asks whether the three renderers
 * agree. A fixture per suite is two claims about the same widget that can drift into disagreeing
 * about what "invalid" even means, and only one of them would be checked.
 *
 * Import it after `installDomGlobals()` — the element registry reaches for `customElements`.
 */
import { mount as mountElement } from "./dom-env.mjs";

const { createLitForm, field, required, min } = await import("../../dist/adapter.js");
const { defineMdyElements } = await import("../../dist/ui.js");
const { MDY_CANONICAL_EMPTY } = await import("../../../widgets/dist/testing/index.js");

defineMdyElements();

const option = { value: "a", label: "A" };

/**
 * The elements this package defines, and the kind each answers to.
 *
 * The value each starts from is **not** here: it is the kind's own empty, from the one table every
 * adapter reads. A per-element initial value is where "the same initial state" quietly stops being
 * the same — a number field started at `0` is filled and valid while the other renderers start
 * empty and required-failing, and the two were never asked the same question.
 */
export const ELEMENTS = [
  ["mdy-text-field", "text"],
  ["mdy-text-field", "email"],
  ["mdy-text-field", "password"],
  ["mdy-textarea-field", "textarea"],
  ["mdy-number-field", "number"],
  ["mdy-slider-field", "slider"],
  ["mdy-checkbox-field", "checkbox"],
  ["mdy-toggle-field", "toggle"],
  ["mdy-radio-group-field", "radio"],
  ["mdy-segmented-field", "segmented"],
  ["mdy-select-field", "select"],
  ["mdy-multiselect-field", "multiselect"],
  ["mdy-datepicker-field", "datepicker"],
  ["mdy-daterange-field", "daterange"],
  ["mdy-timepicker-field", "timepicker"],
  ["mdy-colors-field", "colors"],
  ["mdy-file-field", "file"],
];
export const KINDS = ELEMENTS.map(([, kind]) => kind);
const TAG_FOR = new Map(ELEMENTS.map(([tag, kind]) => [kind, tag]));

export function valueFor(kind) {
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

/**
 * The empty value each kind accepts, from the one table every adapter reads.
 *
 * Copies are handed out because a fixture that returns the shared array lets a renderer mutate the
 * table every other adapter compares against.
 */
export function emptyFor(kind) {
  const empty = MDY_CANONICAL_EMPTY[kind];
  if (Array.isArray(empty)) return [...empty];
  if (empty && typeof empty === "object") return { ...empty };
  return empty;
}

/** The element that opens each composite's overlay, by the part the catalogue names. */
export const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

/**
 * Send a key where the user actually is.
 *
 * An overlay that moves focus into itself handles a key there; one that leaves focus on the opener
 * handles it there. Dispatching at a guessed element tests the guess rather than the widget.
 */
export function pressKey(root, popup, key) {
  const active = root.ownerDocument.activeElement;
  const target = active && (root.contains(active) || popup?.contains(active))
    ? active
    : root.querySelector(OPENER);
  if (!target) return false;
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
  return true;
}

export function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}

export function partsOf(root, kind) {
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

/**
 * Mount one element of `kind`, ready to drive into any state the contract declares for it.
 *
 * `validators` is on by default because most states are unreachable without them: a field with no
 * validator can never be invalid, so every `invalid` row would be green about a state the element
 * cannot enter. Turn them off to observe an element genuinely **at rest** — a required field that is
 * empty is already failing, and a renderer free to show that immediately (the contract permits it)
 * would make "at rest" and "invalid" the same observation.
 */
export async function mount(kind, { validators: withValidators = true } = {}) {
  const tag = TAG_FOR.get(kind);
  // A slider is never empty, so `required` alone can never fail on one and its `invalid` row would
  // be green because the state is unreachable rather than because the renderer is right.
  const validators = !withValidators ? [] : kind === "slider" ? [required(), min(1)] : [required()];
  const form = createLitForm({ value: field(emptyFor(kind), validators) });
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
    value: () => form.f.value.value(),
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
    press: (key) => pressKey(element, partsOf(element, kind).popup, key),
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
          const trigger = element.querySelector(OPENER);
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
