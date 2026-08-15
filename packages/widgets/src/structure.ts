import { MDY_STATE_MODIFIERS, stateClass, type MdyStateName } from "./state.js";

/** Version of the framework-agnostic UI contract implemented by this package. */
export const MDY_WIDGET_CONTRACT_VERSION = 1 as const;

/** Semantic element categories that presenters can map to their native rendering API. */
export type MdyWidgetSemanticElement =
  | "root" | "label" | "input" | "button" | "group" | "status"
  | "listbox" | "option" | "radio" | "dialog" | "grid" | "gridcell" | "container"
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

/**
 * Canonical parts of the form itself, as against a field's shell.
 *
 * Not every refusal belongs to a field. A failed network call, a service that is down, a cross-field
 * rule only a server can check: they arrive with no path, the engine keeps them in
 * `state.lastSubmitErrors()`, and until this part existed there was nowhere in any renderer's markup
 * to put them — so a person pressed Send while the server said no and saw their fields exactly as
 * they had left them.
 *
 * The region is a `status`, not a field's error list: it speaks for the form, it appears after an
 * action the person took, and it is announced when it arrives rather than when it is reached.
 */
export type MdyFormShellPart = "formErrors" | "formErrorItem";

/** Canonical class vocabulary for the form's own parts. */
export const MDY_FORM_SHELL_CLASSES = Object.freeze({
  formErrors: "mdy-form__errors",
  formErrorItem: "mdy-form__error",
} satisfies Record<MdyFormShellPart, string>);

/**
 * Where the form's own refusals sit: first, before the fields.
 *
 * A summary a person has to scroll past their whole form to find is a summary they do not read, and
 * a refusal about the submission as a whole belongs where the submission was answered.
 */
/*
 * Annotated rather than inferred. The two nodes have different shapes — one names a parent, the
 * other does not — so an inferred type is a union of two object literals with optional members, and
 * the two TypeScript implementations write that union's members in different orders. The published
 * type is what this file already means: a structure of this part vocabulary.
 */
export const MDY_FORM_SHELL_STRUCTURE: MdyWidgetStructure<MdyFormShellPart> = Object.freeze({
  kind: "form-shell",
  nodes: Object.freeze<readonly MdyWidgetStructureNode<MdyFormShellPart>[]>([
    { part: "formErrors", element: "status", order: 0, optional: true },
    { part: "formErrorItem", element: "text", parent: "formErrors", order: 0, optional: true, repeated: true },
  ]),
});

// `MdyPartMap` lives with `MdyPartContract`, in `contract.ts`. It was the only thing this module took
// from there, and taking it closed a cycle between the package's two hubs — neither of which could
// then be read, or extracted, on its own. A map of a thing belongs beside the thing.
