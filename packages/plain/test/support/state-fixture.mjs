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
const { MDY_CANONICAL_EMPTY, MDY_CANONICAL_FILLED, settleFor } = await import("../../../widgets/dist/testing/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } = await import("../../../widgets/dist/index.js");

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

/**
 * The element that opens a kind's overlay, resolved from the part the catalogue names.
 *
 * Per kind rather than one selector for all of them, and both halves of that matter. Written out,
 * the list said `.mdy-multiselect__search-btn` after the opener moved to the control, so
 * `drive("open")` answered false — and the assertion that catches that throws *before* the fixture
 * is disposed, leaking a mounted field whose ids collided with every kind tested after it, so three
 * unrelated widgets read as broken. Derived but joined into one selector, it was worse: a daterange's
 * start input carries `mdy-datepicker__input`, which is the *datepicker's* opener, so
 * `querySelector` returned an input that opens nothing and the popup never appeared.
 *
 * One kind, one part, one element.
 */
export function openerOf(root, kind) {
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  const classes = opener ? MDY_WIDGET_CONTRACTS[kind]?.parts?.[opener]?.classes ?? [] : [];
  if (classes.length === 0) return null;
  return root.querySelector(classes.map((cls) => `.${cls}`).join(""));
}

/**
 * Send a key where the user actually is.
 *
 * An overlay that moves focus into itself handles a key there; one that leaves focus on the opener
 * handles it there. Dispatching at a guessed element tests the guess rather than the widget.
 */
export function pressKey(root, popup, key, kind) {
  const active = root.ownerDocument.activeElement;
  const target = active && (root.contains(active) || popup?.contains(active))
    ? active
    : openerOf(root, kind);
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
  // From the table every renderer's suite is measured against, not from a list kept here: the same
  // value has to reach all three fixtures or "the same actions" means nothing. A `File` is the one
  // kind that cannot be written down centrally — two files with the same bytes are still two
  // different values — so the fixture supplies its own, which is what the table says it must.
  if (kind === "file") return [new File(["content"], "report.txt", { type: "text/plain" })];
  const declared = MDY_CANONICAL_FILLED[kind];
  return declared === undefined ? "value" : declared;
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
/**
 * `config` is the document's declarations that are not rules.
 *
 * A field says two different kinds of thing about itself and they travel differently. `rules` are
 * validators: they decide whether a value is acceptable, and the engine builds them. `config` is
 * what the document declares so the control can be *drawn* — a step, a placeholder, a name where
 * nothing captions it — and no validator vocabulary carries them, because they do not judge a
 * value. Handing both through one door would make the kit unable to say which of the two a renderer
 * dropped.
 */
export function mount(kind, { validators = true, variant, rules, value, config } = {}) {
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
    // full coverage having rendered one of them.
    //
    // The name is the config value for the kind that keys on it: a multiselect's `mode` carries the
    // word itself, and a select's presentation is decided by whether it filters — `custom` is the
    // combobox, `native` the platform's chooser. Two axes, one vocabulary, and this is where a name
    // becomes the configuration its own kind reads.
    ...(variant === undefined
      ? // `MDY_WIDGET_STATE_SUPPORT` is keyed by kind, and the states it declares for `select`
        // include `open` — which belongs to the combobox this library builds, not to the chooser
        // the platform draws and owns the popup of. Asked for a select without naming a shape, the
        // state matrix means the one whose states it is describing.
        (kind === "select" ? { searchable: true } : {})
      : kind === "select"
        ? { searchable: variant === "custom" }
        : { mode: variant }),
    // The document's non-rule declarations, spread as the field's own properties, which is how a
    // document states them.
    ...(config ?? {}),
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
    press: (key) => pressKey(root, partsOf(root, kind).popup, key, kind),
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
          const trigger = openerOf(root, kind);
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
