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
const { MDY_CANONICAL_EMPTY, findPartElement } = await import("../../../widgets/dist/testing/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../../widgets/dist/index.js");

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

/**
 * Where each contract part lives in this renderer's DOM — **derived, not listed**.
 *
 * Was a switch over seventeen kinds naming forty-four selectors, every one a class the catalogue
 * already declares. `findPartElement` derives them, disambiguates same-class parts by declared
 * order, and reaches a portalled popup through the opener's `aria-controls`.
 *
 * Measured before deleting the switch, every kind against every state the contract declares for it:
 * **972 parts resolved identically, none differently, none lost** — and 178 found that the map never
 * listed, because a hand-written resolver only lists what someone remembered to.
 */
export function partsOf(root, kind) {
  const out = {};
  for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
    if (node.part === "root") continue;
    out[node.part] = findPartElement(root, kind, node.part, { portalRoots: [root.ownerDocument.body] });
  }
  return out;
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
export async function mount(kind, { validators: withValidators = true, variant } = {}) {
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
    // Without `searchable` a select renders the native chooser, which has no trigger and no popup —
    // deliberately, so a non-searchable list gets the platform's typeahead. Its overlay contract
    // cannot be driven at all in that mode, so the suites that check one ask for the custom combobox.
    if (kind === "select" || kind === "multiselect") el.searchable = true;
    // A kind whose anatomy depends on configuration is mounted per variant; the variant name is the
    // property's own value, so nothing here translates between two vocabularies.
    if (variant && kind === "multiselect") el.mode = variant;
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
