import type { MdyPartContract } from "./contract.js";

/** Version of the framework-agnostic UI contract implemented by this package. */
export const MDY_WIDGET_CONTRACT_VERSION = 1 as const;

/** Semantic element categories that presenters can map to their native rendering API. */
export type MdyWidgetSemanticElement =
  | "root" | "label" | "input" | "button" | "group" | "status"
  | "listbox" | "option" | "dialog" | "grid" | "gridcell"
  | "presentation" | "popup" | "text";

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
  inlineError: "mdy-inline-error-icon",
  supportingText: "mdy-supporting-text",
  errors: "mdy-control__errors",
  errorItem: "mdy-control__error",
} satisfies Record<MdyFieldShellPart, string>);

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
    { part: "inlineError", element: "status", parent: "label", order: 1, optional: true },
    { part: "supportingText", element: "text", parent: "root", order: 2, optional: true },
    { part: "errors", element: "status", parent: "root", order: 3, optional: true },
    { part: "errorItem", element: "text", parent: "errors", order: 0, optional: true, repeated: true },
  ]),
} satisfies MdyWidgetStructure<MdyFieldShellPart>);

/** A typed part map used by widget-specific view contracts. */
export type MdyPartMap<TPart extends string> = Readonly<Record<TPart, MdyPartContract>>;
