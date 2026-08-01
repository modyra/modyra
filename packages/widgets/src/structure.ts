import type { MdyPartContract } from "./contract.js";

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
 * State classes every field carries, independent of kind.
 *
 * Declared here rather than written as literals, so one vocabulary answers both what a renderer
 * should emit and what a theme may rely on.
 *
 * These names are measured, not invented. The previous set — `mdy-field--invalid`,
 * `mdy-control--open` and the rest — was styled by **no theme** and emitted by **no renderer**: a
 * renderer built from the contract alone would have produced classes nothing painted, which is the
 * one failure mode this vocabulary exists to prevent. What is really on screen is a modifier on the
 * renderer root, one on the wrapper holding the control, and one on the label.
 */
export const MDY_FIELD_STATE_CLASSES = Object.freeze({
  /** Base the field root's state modifiers hang from. */
  field: "mdy-renderer",
  /** States the field root reflects. */
  fieldStates: ["touched", "open"],
  /** Base the wrapper holding the control, which is where a field shows it is unusable or wrong. */
  control: "mdy-input-wrapper",
  /** States that wrapper reflects. */
  controlStates: ["disabled", "error"],
  /** Base the label's own modifiers hang from. */
  label: "mdy-label",
  /** States the label reflects: whether the field has a value, and whether it is failing. */
  labelStates: ["filled", "has-error"],
  /** The root modifier an overlay widget carries while its popup is showing. */
  rendererOpen: "mdy-renderer--open",
} as const);

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
