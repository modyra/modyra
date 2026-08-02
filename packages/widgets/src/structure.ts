import type { MdyPartContract } from "./contract.js";
import { MDY_STATE_MODIFIERS, stateClass, type MdyStateName } from "./state.js";

/** Version of the framework-agnostic UI contract implemented by this package. */
export const MDY_WIDGET_CONTRACT_VERSION = 1 as const;

/** Semantic element categories that presenters can map to their native rendering API. */
export type MdyWidgetSemanticElement =
  | "root" | "label" | "input" | "button" | "group" | "status"
  | "listbox" | "option" | "dialog" | "grid" | "gridcell"
  | "presentation" | "popup" | "text" | "affordance" | "columnheader" | "image";

/** One node in a widget's framework-independent structural anatomy. */
export interface MdyWidgetStructureNode<TPart extends string = string> {
  readonly part: TPart;
  readonly element: MdyWidgetSemanticElement;
  readonly parent?: TPart;
  readonly order: number;
  readonly optional?: boolean;
  readonly repeated?: boolean;
}

/** Ordered structural anatomy for a widget. This is metadata, not a virtual DOM. */
export interface MdyWidgetStructure<TPart extends string = string> {
  readonly kind: string;
  readonly nodes: readonly MdyWidgetStructureNode<TPart>[];
}

/** Canonical shell parts shared by field-like controls. */
export type MdyFieldShellPart =
  | "root" | "label" | "requiredMarker" | "inputWrapper" | "prefix"
  | "control" | "suffix" | "inlineError" | "supportingText"
  | "errors" | "errorItem";

/** Canonical class vocabulary. Presenters must not invent adapter-specific equivalents. */
export const MDY_FIELD_SHELL_CLASSES = Object.freeze({
  root: "mdy-renderer",
  label: "mdy-label",
  requiredMarker: "mdy-label__required",
  inputWrapper: "mdy-input-wrapper",
  prefix: "mdy-input-prefix",
  control: "mdy-input-wrapper__inliner",
  suffix: "mdy-input-suffix",
  inlineError: "mdy-control__inline-errors",
  supportingText: "mdy-supporting-text",
  errors: "mdy-control__errors",
  errorItem: "mdy-control__error",
} satisfies Record<MdyFieldShellPart, string>);

/**
 * States every field-like widget's shell parts share.
 *
 * The shell is the same shell whatever it wraps, so its states are declared once rather than
 * seventeen times: a wrapper is disabled or in error, a label is filled or has an error to make room
 * for, a root is open or has been touched.
 *
 * Beside the shell's classes rather than in the catalogue, because a shell part's name and the
 * states it may be in are one fact, and {@link MDY_FIELD_STATE_CLASSES} is derived from both.
 */
export const MDY_SHELL_PART_STATES: Readonly<Record<string, readonly MdyStateName[]>> =
  Object.freeze({
    root: ["open", "touched"],
    inputWrapper: ["disabled", "error"],
    label: ["filled", "hasError"],
    requiredMarker: ["filled"],
  });

/**
 * State classes every field carries, independent of kind.
 *
 * **Derived**, not restated. Every member here already existed as one of `MDY_FIELD_SHELL_CLASSES`,
 * `MDY_SHELL_PART_STATES` or `MDY_STATE_MODIFIERS`, written out a second time and in a second
 * vocabulary: `labelStates` said `"has-error"`, the modifier, where the shell states say
 * `"hasError"`, the state. Two tables for one fact drift the moment one of them is edited, and they
 * drift silently — a theme rule keyed to the spelling nobody updated simply stops matching.
 *
 * The names are measured, not invented. An earlier set — `mdy-field--invalid`, `mdy-control--open`
 * and the rest — was styled by **no theme** and emitted by **no renderer**: a renderer built from
 * the contract alone would have produced classes nothing painted, which is the one failure mode this
 * vocabulary exists to prevent. What is really on screen is a modifier on the renderer root, one on
 * the wrapper holding the control, and one on the label.
 *
 * `fieldStates` and `controlStates` are read twice over by their consumers — once as a key into the
 * field's state, once as the modifier suffix — so they are the state *names*, which for these is
 * also how they are spelled as classes.
 */
const shellStates = (part: string): readonly string[] =>
  (MDY_SHELL_PART_STATES[part] ?? []).map((state) => MDY_STATE_MODIFIERS[state]);

export const MDY_FIELD_STATE_CLASSES = Object.freeze({
  /** Base the field root's state modifiers hang from. */
  field: MDY_FIELD_SHELL_CLASSES.root,
  /** States the field root reflects. */
  fieldStates: Object.freeze(shellStates("root")),
  /** Base the wrapper holding the control, which is where a field shows it is unusable or wrong. */
  control: MDY_FIELD_SHELL_CLASSES.inputWrapper,
  /** States that wrapper reflects. */
  controlStates: Object.freeze(shellStates("inputWrapper")),
  /** Base the label's own modifiers hang from. */
  label: MDY_FIELD_SHELL_CLASSES.label,
  /** States the label reflects: whether the field has a value, and whether it is failing. */
  labelStates: Object.freeze(shellStates("label")),
  /** The root modifier an overlay widget carries while its popup is showing. */
  rendererOpen: stateClass(MDY_FIELD_SHELL_CLASSES.root, "open"),
});

/**
 * Classes that belong to no single widget: the shared button, the overlay machinery, the surface
 * treatments a theme applies wherever it likes.
 *
 * Declared here because they are still contract data — a renderer may emit them and a theme may
 * rely on them — but they are not a kind's anatomy and do not belong to any one catalogue entry.
 */
export const MDY_SHARED_UI_CLASSES = Object.freeze([
  "mdy-button",
  // What the inline error draws inside itself. The part is one element on thirteen kinds; its icon
  // and its tooltip are the same two classes wherever it appears.
  "mdy-control__inline-errors-icon",
  "mdy-control__inline-errors-tooltip",
  // Set on the field root when it shows its errors inline instead of as a list. A choice about the
  // whole field rather than one kind's anatomy, and the themes key off it.
  "mdy-inline-errors",
  "mdy-overlay",
  "mdy-overlay-panel",
  // The scrim behind a modal overlay. One backdrop per panel rather than one per widget, which is
  // why it belongs to the overlay machinery and to no kind's anatomy.
  "mdy-overlay-backdrop",
  "mdy-glass-effect",
  "mdy-glass-effect--medium",
]);

/** Base field anatomy. Widget-specific contracts extend this ordered tree. */
export const MDY_FIELD_SHELL_STRUCTURE = Object.freeze({
  kind: "field-shell",
  nodes: Object.freeze([
    { part: "root", element: "root", order: 0 },
    { part: "label", element: "label", parent: "root", order: 0, optional: true },
    { part: "requiredMarker", element: "text", parent: "label", order: 0, optional: true },
    { part: "inputWrapper", element: "group", parent: "root", order: 1 },
    { part: "prefix", element: "presentation", parent: "inputWrapper", order: 0, optional: true },
    { part: "control", element: "input", parent: "inputWrapper", order: 1 },
    { part: "suffix", element: "presentation", parent: "inputWrapper", order: 2, optional: true },
    { part: "inlineError", element: "image", parent: "label", order: 1, optional: true },
    { part: "supportingText", element: "text", parent: "root", order: 2, optional: true },
    { part: "errors", element: "status", parent: "root", order: 3, optional: true },
    { part: "errorItem", element: "text", parent: "errors", order: 0, optional: true, repeated: true },
  ]),
} satisfies MdyWidgetStructure<MdyFieldShellPart>);

/** A typed part map used by widget-specific view contracts. */
export type MdyPartMap<TPart extends string> = Readonly<Record<TPart, MdyPartContract>>;
