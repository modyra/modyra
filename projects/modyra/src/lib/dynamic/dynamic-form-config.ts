import { MdySelectOption, ValidatorFn } from "../core/types";
import {
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from "../core/validators";

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

/** Option-based kinds. */
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

declare const ngDevMode: boolean | undefined;

/** Every kind the dynamic renderer knows how to draw. */
export const MDY_DYNAMIC_FIELD_KINDS = [
  "text", "textarea", "email", "password",
  "number", "slider",
  "checkbox", "toggle",
  "select", "radio", "multiselect", "segmented",
  "datepicker", "timepicker",
] as const;

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
    if (!(MDY_DYNAMIC_FIELD_KINDS as readonly unknown[]).includes(f.kind)) {
      warnDev(`Dropped dynamic field "${f.name}" with unknown kind "${String(f.kind)}".`);
      return false;
    }
    const needsOptions = ["select", "radio", "multiselect", "segmented"];
    if (
      needsOptions.includes(f.kind as string) &&
      !Array.isArray((f as { options?: unknown }).options)
    ) {
      warnDev(`Dropped dynamic field "${f.name}": kind "${String(f.kind)}" requires an options array.`);
      return false;
    }
    return true;
  });
}

function warnDev(message: string): void {
  if (typeof ngDevMode !== "undefined" && ngDevMode) {
    console.warn(`[modyra] ${message}`);
  }
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
    out.push(pattern(new RegExp(config.pattern)) as ValidatorFn<never>);
  }
  return { validators: out, marksRequired: config.required === true };
}
