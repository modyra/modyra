/**
 * The references a widget's parts must make to each other.
 *
 * Dimension 3 of the specification. These relations existed in two places and neither was the
 * contract: the projections emit them at runtime, and the conformance inspector re-stated the rules
 * in its own code. A rule that lives only in the checker cannot be read by someone implementing the
 * widget, which is precisely what this contract is supposed to make possible.
 *
 * Declaring them also changes what can be caught. The inspector could only ever find a reference
 * that pointed at nothing — a *dangling* id. A control carrying no reference at all has nothing to
 * dangle, so a field whose errors reach no assistive technology looked identical to one with no
 * errors.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";

/** The attributes that carry a reference from one part to another. */
export type MdyRelationAttribute =
  | "for"
  | "aria-describedby"
  | "aria-labelledby"
  | "aria-controls"
  | "aria-activedescendant";

export interface MdyWidgetRelation {
  /** The part carrying the attribute. */
  readonly from: string;
  readonly attribute: MdyRelationAttribute;
  /**
   * The parts it may name, in order of preference. The first one *rendered* is the one it must
   * name — `aria-describedby` points at the error list while there is one and at the supporting
   * text otherwise, and both are the same relation rather than two.
   */
  readonly to: readonly string[];
}

/**
 * Which part a kind's visible label names.
 *
 * `for` only works on a labelable element, so a kind whose control is a `div` with a role is absent
 * here and names its group with `aria-labelledby` instead. Pointing a label at a non-labelable
 * element produces markup that validates as nothing and does not move focus on click.
 */
const LABEL_TARGET: Readonly<Partial<Record<MdyWidgetKind, string>>> = Object.freeze({
  text: "control", email: "control", password: "control", textarea: "control",
  number: "control", slider: "control", file: "control",
  datepicker: "control", timepicker: "control",
  daterange: "startControl",
  select: "trigger",
  multiselect: "trigger",
  // The typeable hex field, not the hidden native picker behind it.
  colors: "hexInput",
  // checkbox and toggle wrap their input in the label itself, which is the association.
  // radio and segmented are groups, named below.
});

/**
 * The part that describes itself by the field's errors or supporting text.
 *
 * The same part the label names, wherever the kind has one: a field cannot have its name on one
 * element and its description on another and still be one control to a screen reader. `colors` said
 * `control` here and `hexInput` above — `control` is the native picker, which renderers are free to
 * make unfocusable, so the description hung off an element the user cannot reach.
 */
const DESCRIBED_BY_CARRIER: Readonly<Partial<Record<MdyWidgetKind, string>>> = Object.freeze({
  text: "control", email: "control", password: "control", textarea: "control",
  number: "control", slider: "control", file: "control", colors: "hexInput",
  checkbox: "control", toggle: "control",
  datepicker: "control", timepicker: "control",
  daterange: "startControl",
  radio: "group", segmented: "group",
  select: "trigger",
  multiselect: "trigger",
});

/** Kinds whose control surface is a container, and therefore names its label rather than being named. */
const GROUP_LABELLED: readonly MdyWidgetKind[] = Object.freeze(["radio", "segmented"]);

function relationsFor(kind: MdyWidgetKind): readonly MdyWidgetRelation[] {
  const declared = new Set<string>(MDY_WIDGET_CONTRACTS[kind].structure.nodes.map((node) => node.part));
  const relations: MdyWidgetRelation[] = [];

  const labelTarget = LABEL_TARGET[kind];
  if (labelTarget && declared.has(labelTarget)) {
    relations.push({ from: "label", attribute: "for", to: [labelTarget] });
  }
  if (GROUP_LABELLED.includes(kind) && declared.has("group")) {
    relations.push({ from: "group", attribute: "aria-labelledby", to: ["label"] });
  }

  const carrier = DESCRIBED_BY_CARRIER[kind];
  if (carrier && declared.has(carrier)) {
    relations.push({ from: carrier, attribute: "aria-describedby", to: ["errors", "supportingText"] });
  }

  const opener = MDY_POPUP_OPENERS[kind];
  if (opener) {
    relations.push({ from: opener.opener, attribute: "aria-controls", to: [opener.controls] });
  }

  return Object.freeze(relations);
}

/** Every relation each kind's parts must make, derived from one declaration per relation type. */
export const MDY_WIDGET_RELATIONS: Readonly<Record<MdyWidgetKind, readonly MdyWidgetRelation[]>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).map((kind) => [kind, Object.freeze(relationsFor(kind).map((entry) => Object.freeze({
        ...entry,
        // One level deeper than the entry itself: a trigger and a list of parts are objects the
        // caller holds a reference to, and an entry frozen around live members is not frozen.
        ...Object.fromEntries(
          Object.entries(entry)
            .filter(([, member]) => member !== null && typeof member === "object")
            .map(([key, member]) => [key, Object.freeze(member)]),
        ),
      })))]),
    ) as Record<MdyWidgetKind, readonly MdyWidgetRelation[]>,
  );

/**
 * Elements a `for` may legitimately name.
 *
 * The HTML rule, not a preference: `label[for]` resolves only to a labelable element, so naming
 * anything else is markup a browser ignores.
 */
export const MDY_LABELABLE_TAGS: readonly string[] = Object.freeze([
  "button", "input", "meter", "output", "progress", "select", "textarea",
]);

/**
 * How a part comes by its accessible name.
 *
 * Dimension 2's remaining half. `element` says what a part *is* and the relations say what it points
 * at; this says how a screen reader is supposed to announce it.
 */
export type MdyAccessibleNameSource =
  /** The host language does it: a `<label for>`, or a label wrapping the control. */
  | "native"
  /** `aria-labelledby`, naming a part that carries the text. */
  | "labelledby"
  /** `aria-label`, because there is no visible text to point at. An icon-only button, a palette. */
  | "label";

/**
 * Semantics that must carry a name whatever kind they appear on.
 *
 * A rule rather than a table per kind, because the requirement comes from what the element *is*: a
 * listbox, a grid or a dialog with no name is announced as an unlabelled container, and the user has
 * to guess what they have landed in. Which mechanism supplies it is the renderer's to choose — the
 * text is the renderer's to translate — but that it has one is not optional.
 */
export const MDY_SEMANTICS_REQUIRING_NAME: readonly string[] = Object.freeze([
  "listbox", "dialog", "grid",
]);

/** The parts of a kind that must be announced with a name of their own. */
export function partsRequiringName(kind: MdyWidgetKind): readonly string[] {
  return MDY_WIDGET_CONTRACTS[kind].structure.nodes
    .filter((node) => MDY_SEMANTICS_REQUIRING_NAME.includes(node.element))
    .map((node) => node.part);
}

/**
 * Opens the platform's own colour chooser from the hidden native input.
 *
 * `showPicker` and not a click: a renderer may guard that input's click to keep a press on the
 * swatch from reaching it twice, and a guarded click is one this door cannot open — the button says
 * it opens something and does nothing, which is the defect a door exists to avoid. The click is the
 * fallback for a platform without the explicit call.
 *
 * Called rather than focused. On some platforms the chooser is a separate window; a panel that
 * dismissed when focus left the page would take the door with it and leave nothing to come back to.
 */
export function openPlatformChooser(control: HTMLInputElement | null | undefined): void {
  if (control === null || control === undefined) return;
  const withPicker = control as HTMLInputElement & { showPicker?: () => void };
  if (typeof withPicker.showPicker === "function") withPicker.showPicker();
  else control.click();
}
