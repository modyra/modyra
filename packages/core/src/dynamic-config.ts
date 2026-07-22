import { MdySelectOption, ValidatorFn } from "./types.js";
import {
  eachOneOf,
  email,
  max,
  maxLength,
  min,
  minLength,
  oneOf,
  pattern,
  required,
} from "./validators.js";

/**
 * Serializable validator set for dynamic fields — safe to store as JSON in
 * a CMS or form-builder backend.
 */
export interface MdyDynamicValidators {
  readonly required?: boolean;
  readonly email?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** RegExp source string. */
  readonly pattern?: string;
}

interface MdyDynamicFieldBase {
  readonly name: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly initialValue?: unknown;
  readonly validators?: MdyDynamicValidators;
}

/** Free-text kinds. */
export interface MdyDynamicTextField extends MdyDynamicFieldBase {
  readonly kind: "text" | "textarea" | "email" | "password";
}

/** Numeric kinds. */
export interface MdyDynamicNumberField extends MdyDynamicFieldBase {
  readonly kind: "number" | "slider";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** Boolean kinds. */
export interface MdyDynamicBooleanField extends MdyDynamicFieldBase {
  readonly kind: "checkbox" | "toggle";
}

/**
 * Option-based kinds. The declared options are also a whitelist:
 * {@link buildDynamicFieldValidators} automatically constrains the field
 * value to them (`oneOf` / `eachOneOf`), so a value outside the list —
 * scripted `set()`, tampered draft, LLM hallucination — fails validation.
 */
export interface MdyDynamicOptionsField extends MdyDynamicFieldBase {
  readonly kind: "select" | "radio" | "multiselect" | "segmented";
  readonly options: ReadonlyArray<MdySelectOption<unknown>>;
}

/** Date/time kinds. */
export interface MdyDynamicDateField extends MdyDynamicFieldBase {
  readonly kind: "datepicker" | "timepicker";
}

/** One field of a dynamic form — a serializable discriminated union. */
export type MdyDynamicField =
  | MdyDynamicTextField
  | MdyDynamicNumberField
  | MdyDynamicBooleanField
  | MdyDynamicOptionsField
  | MdyDynamicDateField;

/** Exhaustiveness helper for kind switches. */
export function assertNeverField(field: never): never {
  throw new Error(
    `[modyra] Unknown dynamic field kind: ${JSON.stringify(field)}`,
  );
}

// ─── Runtime validation of network-borne configs ─────────────────────────────

/** Every kind the dynamic renderer knows how to draw. */
export const MDY_DYNAMIC_FIELD_KINDS = [
  "text", "textarea", "email", "password",
  "number", "slider",
  "checkbox", "toggle",
  "select", "radio", "multiselect", "segmented",
  "datepicker", "timepicker",
] as const;

const MDY_MAX_DYNAMIC_PATTERN_LENGTH = 256;
const MDY_FORBIDDEN_DYNAMIC_NAMES = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidOptions(options: unknown): options is ReadonlyArray<MdySelectOption<unknown>> {
  if (!Array.isArray(options)) return false;
  return options.every((option) => {
    if (typeof option !== "object" || option === null) return false;
    const candidate = option as Partial<MdySelectOption<unknown>>;
    if (!("value" in candidate)) return false;
    if (typeof candidate.label !== "string") return false;
    if (
      candidate.disabled !== undefined &&
      typeof candidate.disabled !== "boolean"
    ) {
      return false;
    }
    return true;
  });
}

function hasValidValidatorConfig(
  validators: unknown,
  fieldName: string,
): validators is MdyDynamicValidators {
  if (validators === undefined) return true;
  if (typeof validators !== "object" || validators === null) {
    warnDev(
      `Dropped dynamic field "${fieldName}": validators must be an object.`,
    );
    return false;
  }
  const config = validators as Partial<MdyDynamicValidators>;
  const boolKeys = ["required", "email"] as const;
  for (const key of boolKeys) {
    const value = config[key];
    if (value !== undefined && typeof value !== "boolean") {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.${key} must be a boolean.`,
      );
      return false;
    }
  }
  const numberKeys = ["min", "max", "minLength", "maxLength"] as const;
  for (const key of numberKeys) {
    const value = config[key];
    if (value !== undefined && !isFiniteNumber(value)) {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.${key} must be a finite number.`,
      );
      return false;
    }
  }
  if (
    config.minLength !== undefined &&
    config.maxLength !== undefined &&
    config.minLength > config.maxLength
  ) {
    warnDev(
      `Dropped dynamic field "${fieldName}": validators.minLength cannot exceed validators.maxLength.`,
    );
    return false;
  }
  if (config.pattern !== undefined) {
    if (typeof config.pattern !== "string") {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.pattern must be a string.`,
      );
      return false;
    }
    if (config.pattern.length > MDY_MAX_DYNAMIC_PATTERN_LENGTH) {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.pattern length exceeds max ${MDY_MAX_DYNAMIC_PATTERN_LENGTH}.`,
      );
      return false;
    }
  }
  return true;
}


/** Recursive Contract v2 node: a renderable leaf, structural group, or repeatable array. */
export interface MdyDynamicFieldNode {
  readonly node: "field";
  readonly field: Omit<MdyDynamicField, "name">;
}
export interface MdyDynamicGroupNode {
  readonly node: "group";
  readonly label?: string;
  readonly children: Readonly<Record<string, MdyDynamicNode>>;
}
export interface MdyDynamicArrayNode {
  readonly node: "array";
  readonly label?: string;
  readonly item: MdyDynamicFieldNode | MdyDynamicGroupNode;
  readonly initialValue?: ReadonlyArray<unknown>;
  readonly minItems?: number;
  readonly maxItems?: number;
}
export type MdyDynamicNode = MdyDynamicFieldNode | MdyDynamicGroupNode | MdyDynamicArrayNode;

/** Flattens a recursive schema to the dotted/indexed paths consumed by the current renderer. */
export function flattenDynamicSchema(schema: MdyDynamicGroupNode): MdyDynamicField[] {
  const out: MdyDynamicField[] = [];
  const visit = (node: MdyDynamicNode, path: string, initial: unknown): void => {
    if (node.node === "field") {
      const candidate = { ...node.field, name: path, initialValue: initial ?? node.field.initialValue } as MdyDynamicField;
      // Generated dotted/index paths are trusted structure; validate the leaf with
      // a temporary safe name, then restore the generated path.
      const parsed = parseDynamicFields([{ ...candidate, name: "leaf" }]);
      if (parsed[0]) out.push({ ...parsed[0], name: path } as MdyDynamicField);
      return;
    }
    if (node.node === "group") {
      const value = isRecordValue(initial) ? initial : {};
      for (const [key, child] of Object.entries(node.children)) {
        if (!isSafeDynamicSegment(key)) continue;
        visit(child, path ? `${path}.${key}` : key, value[key]);
      }
      return;
    }
    const rows = Array.isArray(initial) ? initial : Array.isArray(node.initialValue) ? node.initialValue : [];
    rows.forEach((row, index) => visit(node.item, `${path}.${index}`, row));
  };
  visit(schema, "", undefined);
  return out;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeDynamicSegment(value: string): boolean {
  return value.length > 0 && !value.includes(".") && !MDY_FORBIDDEN_DYNAMIC_NAMES.has(value);
}

/**
 * Versioned envelope for storing a dynamic form config in a CMS/backend.
 * Bump `version` when the field shape changes incompatibly and migrate in
 * your own loader before calling {@link parseDynamicFields}.
 */
export interface MdyDynamicFormConfig {
  readonly version: 1;
  readonly fields: ReadonlyArray<MdyDynamicField>;
}

export type MdyDynamicRuleOperator =
  | "equals" | "notEquals" | "in" | "notIn"
  | "isEmpty" | "isNotEmpty"
  | "greaterThan" | "greaterThanOrEqual"
  | "lessThan" | "lessThanOrEqual";

export interface MdyDynamicRule {
  readonly effect: "visible" | "hidden" | "enabled" | "disabled";
  readonly target: string;
  readonly when: {
    readonly field: string;
    readonly operator: MdyDynamicRuleOperator;
    readonly value?: unknown;
  };
}

export interface MdyDynamicSection {
  readonly kind: "section";
  readonly id: string;
  readonly label?: string;
  readonly children: ReadonlyArray<string>;
}

export interface MdyDynamicColumns {
  readonly kind: "columns";
  readonly id: string;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
}

export type MdyDynamicLayoutNode = MdyDynamicSection | MdyDynamicColumns;

/** Contract v2 adds declarative layout and conditions, never executable code. */
export interface MdyDynamicFormConfigV2 {
  readonly version: 2;
  readonly id?: string;
  readonly fields?: ReadonlyArray<MdyDynamicField>;
  readonly schema?: MdyDynamicGroupNode;
  readonly layout?: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules?: ReadonlyArray<MdyDynamicRule>;
}

export type MdyDynamicFormDocument =
  | MdyDynamicFormConfig
  | MdyDynamicFormConfigV2;

export type MdyDynamicParseMode = "lenient" | "strict";

export interface MdyDynamicDiagnostic {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly path: string;
  readonly message: string;
}

export interface MdyDynamicFormParseResult {
  readonly ok: boolean;
  readonly version: 1 | 2 | null;
  readonly fields: ReadonlyArray<MdyDynamicField>;
  readonly layout: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules: ReadonlyArray<MdyDynamicRule>;
  readonly diagnostics: ReadonlyArray<MdyDynamicDiagnostic>;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
}

/**
 * Validates an untrusted (network/CMS) payload into `MdyDynamicField[]`.
 * TypeScript types do not check runtime JSON — this does.
 *
 * Accepts either a bare field array or a versioned
 * {@link MdyDynamicFormConfig} envelope (unknown versions are rejected).
 * Malformed entries and unknown `kind`s are dropped with a dev-mode warning,
 * so a partially-bad config still renders its valid fields.
 */
export function parseDynamicFields(input: unknown): MdyDynamicField[] {
  let items: unknown;
  if (Array.isArray(input)) {
    items = input;
  } else if (
    typeof input === "object" &&
    input !== null &&
    "fields" in input
  ) {
    const envelope = input as { version?: unknown; fields?: unknown };
    if (envelope.version !== 1 && envelope.version !== 2) {
      warnDev(
        `Unsupported dynamic form config version ${String(envelope.version)} — expected 1 or 2.`,
      );
      return [];
    }
    items = envelope.fields;
  }
  if (!Array.isArray(items)) {
    warnDev("Dynamic form config is neither a field array nor a config envelope.");
    return [];
  }
  const seenNames = new Set<string>();
  return items.filter((item): item is MdyDynamicField => {
    if (typeof item !== "object" || item === null) {
      warnDev(`Dropped non-object dynamic field: ${JSON.stringify(item)}`);
      return false;
    }
    const f = item as Partial<MdyDynamicField>;
    if (typeof f.name !== "string" || f.name.length === 0) {
      warnDev(`Dropped dynamic field without a name: ${JSON.stringify(item)}`);
      return false;
    }
    if (f.name.includes(".") || MDY_FORBIDDEN_DYNAMIC_NAMES.has(f.name)) {
      warnDev(
        `Dropped dynamic field "${f.name}": name is reserved or contains forbidden path separators.`,
      );
      return false;
    }
    if (seenNames.has(f.name)) {
      warnDev(`Dropped duplicate dynamic field name "${f.name}".`);
      return false;
    }
    seenNames.add(f.name);
    if (!(MDY_DYNAMIC_FIELD_KINDS as readonly unknown[]).includes(f.kind)) {
      warnDev(`Dropped dynamic field "${f.name}" with unknown kind "${String(f.kind)}".`);
      return false;
    }
    if (f.label !== undefined && typeof f.label !== "string") {
      warnDev(`Dropped dynamic field "${f.name}": label must be a string.`);
      return false;
    }
    if (f.placeholder !== undefined && typeof f.placeholder !== "string") {
      warnDev(
        `Dropped dynamic field "${f.name}": placeholder must be a string.`,
      );
      return false;
    }
    if (!hasValidValidatorConfig(f.validators, f.name)) {
      return false;
    }
    if (f.kind === "number" || f.kind === "slider") {
      const numberField = f as Partial<MdyDynamicNumberField>;
      if (numberField.min !== undefined && !isFiniteNumber(numberField.min)) {
        warnDev(`Dropped dynamic field "${f.name}": min must be a finite number.`);
        return false;
      }
      if (numberField.max !== undefined && !isFiniteNumber(numberField.max)) {
        warnDev(`Dropped dynamic field "${f.name}": max must be a finite number.`);
        return false;
      }
      if (
        numberField.min !== undefined &&
        numberField.max !== undefined &&
        numberField.min > numberField.max
      ) {
        warnDev(`Dropped dynamic field "${f.name}": min cannot exceed max.`);
        return false;
      }
      if (numberField.step !== undefined) {
        if (!isFiniteNumber(numberField.step)) {
          warnDev(`Dropped dynamic field "${f.name}": step must be a finite number.`);
          return false;
        }
        if (numberField.step <= 0) {
          warnDev(`Dropped dynamic field "${f.name}": step must be greater than zero.`);
          return false;
        }
      }
    }
    const needsOptions = ["select", "radio", "multiselect", "segmented"];
    if (needsOptions.includes(f.kind as string)) {
      const options = (f as { options?: unknown }).options;
      if (!hasValidOptions(options)) {
        warnDev(
          `Dropped dynamic field "${f.name}": kind "${String(f.kind)}" requires a valid options array.`,
        );
        return false;
      }
    }
    return true;
  });
}

let diagnosticSink: ((message: string) => void) | undefined;

function warnDev(message: string): void {
  diagnosticSink?.(message);
  console.warn(`[modyra] ${message}`);
}

function diagnosticCode(message: string): string {
  if (message.includes("Unsupported dynamic form config version")) return "MDY_DYNAMIC_UNSUPPORTED_VERSION";
  if (message.includes("duplicate dynamic field")) return "MDY_DYNAMIC_DUPLICATE_NAME";
  if (message.includes("reserved or contains forbidden")) return "MDY_DYNAMIC_UNSAFE_NAME";
  if (message.includes("unknown kind")) return "MDY_DYNAMIC_UNKNOWN_KIND";
  if (message.includes("requires a valid options")) return "MDY_DYNAMIC_OPTIONS_REQUIRED";
  if (message.includes("pattern length")) return "MDY_DYNAMIC_PATTERN_TOO_LONG";
  return "MDY_DYNAMIC_INVALID_FIELD";
}

function validFieldReference(name: unknown, names: ReadonlySet<string>): name is string {
  return typeof name === "string" && names.has(name);
}

function validateDynamicSchema(input: unknown): MdyDynamicDiagnostic[] {
  const out: MdyDynamicDiagnostic[] = [];
  let count = 0;
  const visit = (raw: unknown, path: string, depth: number): void => {
    count += 1;
    if (depth > 8 || count > 500) { out.push({ code: "MDY_DYNAMIC_SCHEMA_LIMIT", severity: "error", path, message: "schema exceeds depth/node limits." }); return; }
    if (!isRecordValue(raw) || !["field", "group", "array"].includes(String(raw["node"]))) { out.push({ code: "MDY_DYNAMIC_INVALID_NODE", severity: "error", path, message: "node must be field, group, or array." }); return; }
    if (raw["node"] === "field") {
      if (!isRecordValue(raw["field"])) out.push({ code: "MDY_DYNAMIC_INVALID_FIELD", severity: "error", path: `${path}/field`, message: "field node requires a field object." });
      return;
    }
    if (raw["node"] === "group") {
      if (!isRecordValue(raw["children"])) { out.push({ code: "MDY_DYNAMIC_INVALID_GROUP", severity: "error", path, message: "group requires children." }); return; }
      for (const [key, child] of Object.entries(raw["children"])) {
        if (!isSafeDynamicSegment(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/children/${key}`, message: "unsafe child name." });
        else visit(child, `${path}/children/${key}`, depth + 1);
      }
      return;
    }
    if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path, message: "array requires an item node." });
    else visit(raw["item"], `${path}/item`, depth + 1);
    if (raw["initialValue"] !== undefined && !Array.isArray(raw["initialValue"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path: `${path}/initialValue`, message: "array initialValue must be an array." });
    if (Array.isArray(raw["initialValue"]) && raw["initialValue"].length > 100) out.push({ code: "MDY_DYNAMIC_SCHEMA_LIMIT", severity: "error", path: `${path}/initialValue`, message: "array initialValue exceeds 100 rows." });
  };
  visit(input, "/schema", 0);
  return out;
}

/** Parses v1/v2 untrusted input with structured diagnostics. */
export function parseDynamicForm(
  input: unknown,
  options: { readonly mode?: MdyDynamicParseMode } = {},
): MdyDynamicFormParseResult {
  const diagnostics: MdyDynamicDiagnostic[] = [];
  const previousSink = diagnosticSink;
  diagnosticSink = (message) => diagnostics.push({
    code: diagnosticCode(message), severity: "error", path: "/fields", message,
  });
  const rawEnvelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; schema?: unknown }
    : undefined;
  let fields: MdyDynamicField[];
  try {
    fields = rawEnvelope?.version === 2 && rawEnvelope.schema !== undefined
      ? []
      : parseDynamicFields(input);
  } finally { diagnosticSink = previousSink; }

  const envelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; fields?: unknown; schema?: unknown; layout?: unknown; rules?: unknown }
    : undefined;
  const version: 1 | 2 | null = Array.isArray(input) || envelope?.version === 1
    ? 1 : envelope?.version === 2 ? 2 : null;
  if (version === 2 && envelope?.schema !== undefined) {
    const schemaDiagnostics = validateDynamicSchema(envelope.schema);
    diagnostics.push(...schemaDiagnostics);
    if (schemaDiagnostics.length === 0) fields = flattenDynamicSchema(envelope.schema as MdyDynamicGroupNode);
  }
  const names = new Set(fields.map((field) => field.name));
  const layout: MdyDynamicLayoutNode[] = [];
  const rules: MdyDynamicRule[] = [];

  if (version === 2 && envelope) {
    if (envelope.layout !== undefined && !Array.isArray(envelope.layout)) {
      diagnostics.push({ code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path: "/layout", message: "layout must be an array." });
    } else for (const [index, raw] of (envelope.layout ?? []).entries()) {
      if (typeof raw !== "object" || raw === null) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path: `/layout/${index}`, message: "layout node must be an object." });
        continue;
      }
      const node = raw as Partial<MdyDynamicLayoutNode>;
      const refs = node.kind === "section" ? node.children : node.kind === "columns" ? node.columns?.flat() : undefined;
      if (typeof node.id !== "string" || !refs || refs.some((ref) => !validFieldReference(ref, names))) {
        diagnostics.push({ code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", severity: "error", path: `/layout/${index}`, message: "layout references an unknown field or has an invalid shape." });
        continue;
      }
      layout.push(raw as MdyDynamicLayoutNode);
    }
    if (envelope.rules !== undefined && !Array.isArray(envelope.rules)) {
      diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: "/rules", message: "rules must be an array." });
    } else for (const [index, raw] of (envelope.rules ?? []).entries()) {
      if (typeof raw !== "object" || raw === null) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}`, message: "rule must be an object." });
        continue;
      }
      const rule = raw as Partial<MdyDynamicRule>;
      const effects = ["visible", "hidden", "enabled", "disabled"];
      const operators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];
      if (!effects.includes(rule.effect ?? "") || !validFieldReference(rule.target, names) || !rule.when || !validFieldReference(rule.when.field, names) || !operators.includes(rule.when.operator)) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}`, message: "rule has an unsupported effect/operator or references an unknown field." });
        continue;
      }
      rules.push(raw as MdyDynamicRule);
    }
  }

  const sourceCount = Array.isArray(input) ? input.length : Array.isArray(envelope?.fields) ? envelope.fields.length : fields.length;
  const rejectedCount = Math.max(0, sourceCount - fields.length) + diagnostics.filter((d) => d.path.startsWith("/layout/") || d.path.startsWith("/rules/")).length;
  const strict = options.mode === "strict";
  return {
    ok: version !== null && (!strict || diagnostics.length === 0),
    version,
    fields: strict && diagnostics.length > 0 ? [] : fields,
    layout: strict && diagnostics.length > 0 ? [] : layout,
    rules: strict && diagnostics.length > 0 ? [] : rules,
    diagnostics, acceptedCount: fields.length, rejectedCount,
  };
}

/**
 * Maps the serializable validator set to validator functions.
 * Returns the functions plus whether the set marks the field required.
 */
export function buildDynamicValidators(config: MdyDynamicValidators): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const out: Array<ValidatorFn<never>> = [];
  if (config.required) out.push(required());
  if (config.email) out.push(email() as ValidatorFn<never>);
  if (config.min !== undefined) out.push(min(config.min) as ValidatorFn<never>);
  if (config.max !== undefined) out.push(max(config.max) as ValidatorFn<never>);
  if (config.minLength !== undefined) {
    out.push(minLength(config.minLength) as ValidatorFn<never>);
  }
  if (config.maxLength !== undefined) {
    out.push(maxLength(config.maxLength) as ValidatorFn<never>);
  }
  if (config.pattern !== undefined) {
    if (config.pattern.length > MDY_MAX_DYNAMIC_PATTERN_LENGTH) {
      warnDev(
        `Skipped dynamic pattern validator: pattern length ${config.pattern.length} exceeds max ${MDY_MAX_DYNAMIC_PATTERN_LENGTH}.`,
      );
    } else {
      try {
        out.push(pattern(new RegExp(config.pattern)) as ValidatorFn<never>);
      } catch {
        warnDev(
          `Skipped dynamic pattern validator: invalid RegExp source "${config.pattern}".`,
        );
      }
    }
  }
  return { validators: out, marksRequired: config.required === true };
}

/**
 * Builds the full validator set for one dynamic field: the configured
 * validators ({@link buildDynamicValidators}) plus, for option-based
 * kinds, an automatic whitelist of the declared option values — the
 * client-side anti-tampering guard ("select offers one/two → three is
 * invalid"). `select`/`radio`/`segmented` get `oneOf`, `multiselect` gets
 * `eachOneOf`. Prefer this over {@link buildDynamicValidators} whenever
 * the whole field config is available.
 */
export function buildDynamicFieldValidators(field: MdyDynamicField): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const base = buildDynamicValidators(field.validators ?? {});
  if (
    field.kind === "select" ||
    field.kind === "radio" ||
    field.kind === "segmented"
  ) {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, oneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  if (field.kind === "multiselect") {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, eachOneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  return base;
}
