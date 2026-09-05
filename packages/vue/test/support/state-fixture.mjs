/**
 * One component of a kind, mounted and drivable — the Vue renderer's answer to `MdyStateFixture`.
 *
 * The shape `MdyStateFixture` declares, deliberately: the equivalence suite asks whether every
 * renderer produces one canonical observation, and a fixture that mounted its own way, with its own
 * initial value or its own idea of "invalid", would make each suite ask a different question and
 * report agreement on none of them.
 *
 * Import it after `installDomGlobals()` — mounting reaches for `document`.
 */
import { installDomGlobals } from "./dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../../dist/index.js");
const { field, required, min, max, minLength, maxLength } = await import("../../../core/dist/index.js");
const { MDY_CANONICAL_EMPTY, MDY_CANONICAL_FILLED, findPartElement, settleFor } =
  await import("../../../widgets/dist/testing/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } = await import("../../../widgets/dist/index.js");

/**
 * Vue schedules its own update after a write, so a task turn is what makes the DOM say what the
 * signals already say. Nothing here forces a re-render: whether the component subscribed to the
 * signal that changed is exactly what these suites are for.
 */
const PAINT_BEAT = "task";

const option = { value: "a", label: "A" };

/**
 * The components this package publishes, and the kind each answers to.
 *
 * Several kinds share a component and are told which they are — a boolean is a checkbox or a toggle,
 * an option list is radios or a segmented control — so the kind is what the suite names and the
 * props below are how this renderer is put into that shape.
 */
export const COMPONENTS = [
  ["MdyTextField", "text"],
  ["MdyTextField", "email"],
  ["MdyTextField", "password"],
  ["MdyTextField", "textarea"],
  ["MdyTextField", "number"],
  ["MdySliderField", "slider"],
  ["MdyBooleanField", "checkbox"],
  ["MdyBooleanField", "toggle"],
  ["MdyOptionField", "radio"],
  ["MdyOptionField", "segmented"],
  ["MdySelectField", "select"],
  ["MdyMultiselectField", "multiselect"],
  ["MdyDatepickerField", "datepicker"],
  ["MdyDaterangeField", "daterange"],
  ["MdyTimepickerField", "timepicker"],
  ["MdyColorsField", "colors"],
  ["MdyFileField", "file"],
];
export const KINDS = COMPONENTS.map(([, kind]) => kind);
const COMPONENT_FOR = new Map(COMPONENTS.map(([name, kind]) => [kind, name]));

/** The filled value each kind takes, from the table every renderer's suite is measured against. */
export function valueFor(kind) {
  // A `File` is the one value that cannot be written down centrally — two files with the same bytes
  // are still two different values — so the fixture supplies its own, which is what the table says.
  if (kind === "file") return [new File(["content"], "report.txt", { type: "text/plain" })];
  const declared = MDY_CANONICAL_FILLED[kind];
  return declared === undefined ? "value" : declared;
}

/**
 * The empty value each kind accepts, from the one table every adapter reads.
 *
 * Copies are handed out because a fixture that returned the shared array would let a renderer mutate
 * the table every other adapter compares against.
 */
export function emptyFor(kind) {
  const empty = MDY_CANONICAL_EMPTY[kind];
  if (Array.isArray(empty)) return [...empty];
  if (empty && typeof empty === "object") return { ...empty };
  return empty;
}

/** The element that opens a kind's overlay, resolved from the part the catalogue names. */
export function openerOf(root, kind) {
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  const classes = opener ? MDY_WIDGET_CONTRACTS[kind]?.parts?.[opener]?.classes ?? [] : [];
  if (classes.length === 0) return null;
  return root.querySelector(classes.map((cls) => `.${cls}`).join(""));
}

export function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}

/** Where each contract part lives in this renderer's DOM — derived from the catalogue, not listed. */
export function partsOf(root, kind) {
  const out = {};
  for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
    if (node.part === "root") continue;
    out[node.part] = findPartElement(root, kind, node.part, { portalRoots: [root.ownerDocument.body] });
  }
  return out;
}

/**
 * Send a key where the user actually is: an overlay that moves focus into itself handles the key
 * there, one that leaves focus on the opener handles it there.
 */
export function pressKey(root, popup, key, kind) {
  const active = root.ownerDocument.activeElement;
  const target = active && (root.contains(active) || popup?.contains(active)) ? active : openerOf(root, kind);
  if (!target) return false;
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
  return true;
}

/** What this renderer has to be told to draw a kind in the shape the contract names. */
function propsFor(kind, variant) {
  const props = {};
  if (kind === "email" || kind === "password" || kind === "textarea" || kind === "number") props.kind = kind;
  if (kind === "toggle") props.kind = "toggle";
  if (kind === "segmented") props.kind = "segmented";
  if (kind === "radio" || kind === "segmented" || kind === "select" || kind === "multiselect") props.options = [option];
  // Without `searchable` a select renders the native chooser, which has no trigger and no panel of
  // its own — deliberately, so a non-searchable list gets the platform's typeahead. Its overlay
  // contract cannot be driven at all in that mode, so the suites that check one ask for the combobox.
  if (kind === "select" || kind === "multiselect") props.searchable = true;
  if (variant && kind === "multiselect") props.mode = variant;
  if (variant && kind === "select") props.searchable = variant === "custom";
  return props;
}

/**
 * Mount one component of `kind`, ready to drive into any state the contract declares for it.
 *
 * `validators` is on by default because most states are unreachable without them: a field with no
 * validator can never be invalid, so every `invalid` row would be green about a state the component
 * cannot enter. Turn them off to observe one genuinely at rest.
 */
export async function mount(kind, { validators: withValidators = true, variant, rules, value, label = "Label" } = {}) {
  const name = COMPONENT_FOR.get(kind);
  if (!name) throw new Error(`no Vue component draws ${kind}`);
  // A slider is never empty, so `required` alone can never fail on one and its `invalid` row would
  // be green because the state is unreachable rather than because the renderer is right.
  const validators = rules
    ? [
        ...(rules.min !== undefined ? [min(rules.min)] : []),
        ...(rules.max !== undefined ? [max(rules.max)] : []),
        ...(rules.minLength !== undefined ? [minLength(rules.minLength)] : []),
        ...(rules.maxLength !== undefined ? [maxLength(rules.maxLength)] : []),
      ]
    : !withValidators
      ? []
      : kind === "slider"
        ? [required(), min(1)]
        : [required()];

  const form = m.createVueForm({ value: field(value !== undefined ? value : emptyFor(kind), validators) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(m[name], {
      field: form.f.value, widgetId: "value",
      ...(label !== null ? { label } : {}),
      ...propsFor(kind, variant),
    }),
  });
  app.mount(host);
  await nextTick();
  const root = host.firstElementChild;

  return {
    root,
    parts: () => partsOf(root, kind),
    control: () => controlOf(root),
    value: () => form.f.value.value(),
    /** The handle itself, for a suite that has to write to it after the component is gone. */
    handle: form.f.value,
    settle: settleFor(PAINT_BEAT, () => nextTick()),
    dispose: () => { app.unmount(); host.remove(); },
    press: (key) => pressKey(root, partsOf(root, kind).popup, key, kind),
    drive(state) {
      const handle = form.f.value;
      switch (state) {
        case "pristine": return true;
        case "empty": handle.set(emptyFor(kind)); return true;
        case "filled": handle.set(valueFor(kind)); return true;
        case "touched": handle.markAsTouched(); return true;
        case "invalid": handle.set(emptyFor(kind)); handle.markAsTouched(); return true;
        case "focused": controlOf(root)?.focus?.(); return true;
        case "selected": handle.set(valueFor(kind)); return true;
        case "disabled": form.setDisabled("value", () => true); return true;
        case "readonly": form.setReadonly("value", () => true); return true;
        case "open": {
          const trigger = openerOf(root, kind);
          if (!trigger) return false;
          trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
          return true;
        }
        default: return false;
      }
    },
  };
}
