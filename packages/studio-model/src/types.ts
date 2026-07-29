/**
 * Canonical Studio project model. See:
 * - 5-6
 *
 * No DOM/React/Angular/target import here — this package is framework-neutral (, ).
 */

export const STUDIO_VERSION = 1 as const;

/**
 * Every kind here must have a Contract v2 equivalent in studio-contract's
 * FIELD_KIND_MAP — the value type drives validator compatibility, the kind only
 * drives which control renders.
 */
export type StudioFieldKind =
  | "text"
  | "textarea"
  | "email"
  | "password"
  | "number"
  | "slider"
  | "checkbox"
  | "toggle"
  | "select"
  | "radio"
  | "segmented"
  | "multiselect"
  | "date"
  | "time";

export type StudioValueType = "string" | "number" | "boolean" | "date" | "string[]";

export interface StudioOption {
  value: string;
  label: string;
}

/** Reference by ID only — never a path (ADR 0002). */
export interface NodeRef {
  nodeId: string;
}

export type StudioValidatorKind =
  | "required"
  | "email"
  | "min"
  | "max"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "oneOf"
  | "eachOneOf"
  | "customRef";

export interface StudioFieldValidator {
  id: string;
  kind: StudioValidatorKind;
  message?: string;
  value?: unknown;
  pattern?: string;
  implementationRef?: string;
}

export type StudioExpressionOp =
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "isNotEmpty"
  | "lengthAtLeast"
  | "lengthAtMost"
  | "greaterThan"
  | "lessThan"
  | "matches"
  | "and"
  | "or"
  | "not";

export type StudioOperand = NodeRef | string | number | boolean | null | StudioExpression;

/** Portable, target-neutral expression tree (ADR 0005). */
export interface StudioExpression {
  op: StudioExpressionOp;
  operand?: StudioOperand;
  operands?: StudioOperand[];
}

export interface StudioServerValidator {
  id: string;
  kind: "server";
  implementationRef: string;
  dependencies: NodeRef[];
  debounceMs?: number;
  timeoutMs?: number;
  skipWhen?: StudioExpression;
  errorMessage?: string;
}

export interface StudioArrayValidator {
  id: string;
  kind: StudioValidatorKind;
  message?: string;
  value?: unknown;
}

export interface StudioFormValidator {
  id: string;
  kind: "crossField" | "form";
  dependencies: NodeRef[];
  condition: StudioExpression;
  message: string;
  errorTarget?: NodeRef | null;
}

export interface NodeBase {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

export interface FieldNode extends NodeBase {
  node: "field";
  fieldKind: StudioFieldKind;
  valueType: StudioValueType;
  initialValue: unknown;
  validators: StudioFieldValidator[];
  serverValidator?: StudioServerValidator;
  options?: StudioOption[];
  /**
   * Whether the devtools panel may show this field's value in the clear.
   *
   * Unset means "let the panel guess from the name", which is what it has always done — right often
   * enough to be useful, wrong in both directions often enough to matter.
   */
  sensitive?: boolean;
}

export interface GroupNode extends NodeBase {
  node: "group";
  children: StudioSchemaNode[];
}

export interface ArrayNode extends NodeBase {
  node: "array";
  item: FieldNode | GroupNode;
  initialRows: unknown[];
  validators: StudioArrayValidator[];
}

export type StudioSchemaNode = FieldNode | GroupNode | ArrayNode;

/** Symbolic reference + generated stub, never inline code (, ). */
export interface StudioImplementationRef {
  id: string;
  role: "serverValidator" | "customValidator" | "submitAction";
  displayName: string;
  mode: "stub" | "reference";
  targetOverrides?: Record<string, unknown>;
}

export interface StudioFormBehaviors {
  draft?: { key: string; exclude?: NodeRef[] };
  submit?: { implementationRef: string };
  serverErrorMapping?: string;
}

/**
 * A slot in the form layout: a node (by ID — never a path, ADR-0002) or a nested layout node,
 * so a column row can sit inside a section.
 */
/** The sizes a layout is authored against, mirroring `MDY_LAYOUT_BREAKPOINTS`. */
export type StudioLayoutBreakpoint = "base" | "sm" | "md" | "lg";

/** Where a slot sits and whether it shows, at one size. Contract v3's per-slot `at`. */
export interface StudioSlotPlacement {
  /** 1-based, like a grid line. */
  column?: number;
  hidden?: boolean;
}

/**
 * A layout slot: a reference, and optionally what that reference does at each size.
 *
 * It extends `NodeRef` rather than replacing it, so every `"nodeId" in child` reading of a layout
 * keeps working and a slot with nothing to say serializes as the `{ nodeId }` it always was.
 */
export interface StudioLayoutSlot extends NodeRef {
  at?: Partial<Record<StudioLayoutBreakpoint, StudioSlotPlacement>>;
}

export type StudioLayoutChild = StudioLayoutSlot | StudioLayoutNode;

export interface StudioLayoutSection {
  kind: "section";
  id: string;
  label?: string;
  children: StudioLayoutChild[];
}

export interface StudioLayoutColumns {
  kind: "columns";
  id: string;
  columns: StudioLayoutChild[][];
  /** How many tracks the row shows at each size. Omitted sizes inherit the next smaller one. */
  at?: Partial<Record<StudioLayoutBreakpoint, number>>;
}

export type StudioLayoutNode = StudioLayoutSection | StudioLayoutColumns;

/** Presentation is where arrangement lives — it never changes the schema or a field's value. */
export interface StudioPresentationModel {
  /** Arranged part of the form. Anything not mentioned renders after it, in schema order. */
  layout?: StudioLayoutNode[];
  [key: string]: unknown;
}

/** Depth cap for nested layout, matching Contract v2's own guard. */
export const STUDIO_LAYOUT_MAX_DEPTH = 6;

export type StudioProjectMetadata = Record<string, unknown>;

export interface MdyStudioProject {
  studioVersion: 1;
  id: string;
  name: string;
  schema: StudioSchemaNode;
  formValidators: StudioFormValidator[];
  behaviors: StudioFormBehaviors;
  implementations: Record<string, StudioImplementationRef>;
  presentation: StudioPresentationModel;
  targets: Record<string, unknown>;
  metadata: StudioProjectMetadata;
}

export interface StudioDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeId?: string;
  validatorId?: string;
  propertyPath?: string;
  targetId?: string;
}

/** Names that would collide with object-prototype internals or JS reserved identifiers. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);
