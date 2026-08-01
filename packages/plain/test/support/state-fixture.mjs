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
 * The empty value each kind can actually hold.
 *
 * A driver that hands every kind `""` is telling the truth for a text field and lying for a
 * daterange, where it is a *string where an object belongs*: `required` then rejects it for being an
 * empty string rather than for being an empty range, and the row is green about a state the widget
 * was never in.
 */
export function emptyFor(kind) {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": return null;
    case "file": return [];
    // A slider is never empty: its thumb is somewhere, and that somewhere is its minimum. Driving
    // `null` asks the renderer for a state the kind cannot be in.
    case "slider": return 0;
    case "daterange": return { start: null, end: null };
    default: return "";
  }
}

/** Mount one widget of `kind`, ready to drive into any state the contract declares for it. */
export function mount(kind) {
  const host = document.createElement("div");
  document.body.append(host);
  const fieldFor = (extra) => ({
    name: "f", kind, label: "F",
    // A slider is never empty, so `required` alone can never fail on one and its `invalid` row would
    // be green because the state is unreachable rather than because the renderer is right.
    validators: kind === "slider" ? { required: true, min: 1 } : { required: true },
    ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
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
    // A popup lifted out of the widget's subtree is still the widget's. A snapshot that could not
    // reach it would call every portalled overlay absent.
    portalRoots: () => Array.from(document.body.children).filter(
      (element) => !host.contains(element) && element.querySelector?.("[class*='__dropdown']"),
    ),
    // Plain's effects land on a task rather than synchronously.
    settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
    dispose: () => { mounted.dispose(); host.remove(); },
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
          const trigger = root.querySelector(
            ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle, .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
          );
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
