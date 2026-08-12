/**
 * One widget of a kind, mounted and drivable — the Plain renderer's answer to `MdyStateFixture`.
 *
 * Both suites that observe a widget in a state mount it through here: the state matrix, which asks
 * whether this renderer is right, and the equivalence suite, which asks whether the three renderers
 * agree. A fixture per suite is two claims about the same widget that can drift into disagreeing
 * about what "invalid" even means, and only one of them would be checked.
 *
 * Import it after `installDomGlobals()` — it reaches for `document` as it builds.
 */
const { mountMdyForm } = await import("../../dist/index.js");
const { partsOf } = await import("../contract-parts.mjs");
const { MDY_CANONICAL_EMPTY, settleFor } = await import("../../../widgets/dist/testing/index.js");

/** This renderer schedules onto a task: a signal write is not in the DOM until the turn ends. */
const PAINT_BEAT = "task";


export const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select", "multiselect"]);

/** Every kind this renderer draws. */
export const KINDS = [
  "text", "email", "password", "textarea", "number", "slider",
  "checkbox", "toggle",
  "radio", "segmented", "select", "multiselect",
  "datepicker", "daterange", "timepicker", "colors",
  "file",
];

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

/** The element that takes input, wherever the kind puts it. */
export function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}

/** A value each kind will actually accept — a filled state reached with a rejected value is empty. */
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
 * The empty value each kind can actually hold, from the one table every adapter reads.
 *
 * A driver that hands every kind `""` is telling the truth for a text field and lying for a
 * daterange, where it is a *string where an object belongs*: `required` then rejects it for being an
 * empty string rather than for being an empty range, and the row is green about a state the widget
 * was never in.
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

/**
 * Mount one widget of `kind`, ready to drive into any state the contract declares for it.
 *
 * `validators` is on by default because most states are unreachable without them: a field with no
 * validator can never be invalid, so every `invalid` row would be green about a state the widget
 * cannot enter. Turn them off to observe a widget genuinely **at rest** — a required field that is
 * empty is already failing, and a renderer free to show that immediately (the contract permits it)
 * would make "at rest" and "invalid" the same observation.
 */
export function mount(kind, { validators = true, variant, rules, value } = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const fieldFor = (extra) => ({
    name: "f", kind, label: "F",
    // A slider is never empty, so `required` alone can never fail on one and its `invalid` row would
    // be green because the state is unreachable rather than because the renderer is right.
    // `rules` states them in the contract's own vocabulary, so the conformance kit can ask for a
    // constraint without knowing how this renderer declares one.
    ...(rules ? { validators: rules } : validators
      ? { validators: kind === "slider" ? { required: true, min: 1 } : { required: true } }
      : {}),
    ...(value !== undefined ? { initialValue: value } : {}),
    ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
    // A kind whose anatomy depends on configuration is mounted per variant, or the suite reports
    // full coverage having rendered one of them. The variant name *is* the config value.
    ...(variant ? { mode: variant } : {}),
    ...extra,
  });
  let mounted = mountMdyForm(host, [fieldFor({})], { submitLabel: null });
  let root = host.querySelector(`[data-mdy-field="f"]`);
  let handle = mounted.form.f.f;

  // `loading` is a property of the field the renderer reads as it builds, not a signal it watches,
  // so driving it means building the field again rather than poking the DOM this one produced.
  const remount = (extra) => {
    mounted.dispose();
    host.replaceChildren();
    mounted = mountMdyForm(host, [fieldFor(extra)], { submitLabel: null });
    root = host.querySelector(`[data-mdy-field="f"]`);
    handle = mounted.form.f.f;
  };

  return {
    get root() { return root; },
    parts: () => partsOf(root, kind),
    control: () => controlOf(root),
    value: () => handle.value(),
    // Plain's effects land on a task rather than synchronously.
    settle: settleFor(PAINT_BEAT),
    dispose: () => { mounted.dispose(); host.remove(); },
    press: (key) => pressKey(root, partsOf(root, kind).popup, key),
    drive(state) {
      switch (state) {
        case "pristine": return true;
        case "empty": handle.set(emptyFor(kind)); return true;
        case "filled": handle.set(valueFor(kind)); return true;
        case "touched": handle.markAsTouched(); return true;
        case "invalid": handle.set(emptyFor(kind)); handle.markAsTouched(); return true;
        case "focused":
          (controlOf(root) ?? root.querySelector("button, [tabindex]"))?.focus?.();
          return true;
        case "selected": handle.set(valueFor(kind)); return true;
        case "disabled": mounted.form.setDisabled("f", () => true); return true;
        case "readonly": mounted.form.setReadonly("f", () => true); return true;
        case "open": {
          const trigger = root.querySelector(OPENER);
          if (!trigger) return false;
          trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
          return true;
        }
        case "loading": remount({ loading: true }); return true;
        default: return false;
      }
    },
  };
}
