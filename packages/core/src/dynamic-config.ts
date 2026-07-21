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

/**
 * Versioned envelope for storing a dynamic form config in a CMS/backend.
 * Bump `version` when the field shape changes incompatibly and migrate in
 * your own loader before calling {@link parseDynamicFields}.
 */
export interface MdyDynamicFormConfig {
  readonly version: 1;
  readonly fields: ReadonlyArray<MdyDynamicField>;
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
    if (envelope.version !== 1) {
      warnDev(
        `Unsupported dynamic form config version ${String(envelope.version)} — expected 1.`,
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

function warnDev(message: string): void {
  console.warn(`[modyra] ${message}`);
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
