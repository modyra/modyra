/**
 * Validator registry (plan section 6 "Registry says: supported value types,
 * scope, duplicate allowed, default config, diagnostics"). Pure data + pure
 * helpers — no framework, no UI. Used by studio-editor's commands to reject
 * incompatible/duplicate validators (P5 gate: "bad compatibility diagnosed")
 * and by studio-ui to only ever offer compatible options (never lets a user
 * pick something the model will reject).
 */
import type { StudioFieldValidator, StudioValidatorKind, StudioValueType } from "./types.js";

export interface FieldValidatorRegistryEntry {
  kind: StudioValidatorKind;
  displayName: string;
  supportedValueTypes: StudioValueType[];
  /** Can the same field carry more than one validator of this kind? */
  duplicateAllowed: boolean;
  /** Fresh id-less config for a newly added validator of this kind. */
  defaultConfig: () => Omit<StudioFieldValidator, "id" | "kind">;
}

export const FIELD_VALIDATOR_REGISTRY: readonly FieldValidatorRegistryEntry[] = [
  {
    kind: "required",
    displayName: "Required",
    supportedValueTypes: ["string", "number", "boolean", "date", "string[]"],
    duplicateAllowed: false,
    defaultConfig: () => ({}),
  },
  {
    kind: "email",
    displayName: "Email format",
    supportedValueTypes: ["string"],
    duplicateAllowed: false,
    defaultConfig: () => ({}),
  },
  {
    kind: "min",
    displayName: "Minimum value",
    supportedValueTypes: ["number"],
    duplicateAllowed: false,
    defaultConfig: () => ({ value: 0 }),
  },
  {
    kind: "max",
    displayName: "Maximum value",
    supportedValueTypes: ["number"],
    duplicateAllowed: false,
    defaultConfig: () => ({ value: 0 }),
  },
  {
    kind: "minLength",
    displayName: "Minimum length",
    supportedValueTypes: ["string", "string[]"],
    duplicateAllowed: false,
    defaultConfig: () => ({ value: 0 }),
  },
  {
    kind: "maxLength",
    displayName: "Maximum length",
    supportedValueTypes: ["string", "string[]"],
    duplicateAllowed: false,
    defaultConfig: () => ({ value: 0 }),
  },
  {
    kind: "pattern",
    displayName: "Pattern (regex)",
    supportedValueTypes: ["string"],
    duplicateAllowed: true,
    defaultConfig: () => ({ pattern: "", message: "" }),
  },
  {
    kind: "oneOf",
    displayName: "One of (options)",
    supportedValueTypes: ["string", "number"],
    duplicateAllowed: false,
    defaultConfig: () => ({}),
  },
  {
    kind: "eachOneOf",
    displayName: "Each one of (options)",
    supportedValueTypes: ["string[]"],
    duplicateAllowed: false,
    defaultConfig: () => ({}),
  },
  {
    kind: "customRef",
    displayName: "Custom validator",
    supportedValueTypes: ["string", "number", "boolean", "date", "string[]"],
    duplicateAllowed: true,
    defaultConfig: () => ({}),
  },
];

export function getFieldValidatorRegistryEntry(kind: StudioValidatorKind): FieldValidatorRegistryEntry | undefined {
  return FIELD_VALIDATOR_REGISTRY.find((entry) => entry.kind === kind);
}

export function isValidatorCompatible(kind: StudioValidatorKind, valueType: StudioValueType): boolean {
  return getFieldValidatorRegistryEntry(kind)?.supportedValueTypes.includes(valueType) ?? false;
}

export function compatibleValidatorKinds(valueType: StudioValueType): StudioValidatorKind[] {
  return FIELD_VALIDATOR_REGISTRY.filter((entry) => entry.supportedValueTypes.includes(valueType)).map((entry) => entry.kind);
}

export function isDuplicateKindAllowed(kind: StudioValidatorKind): boolean {
  return getFieldValidatorRegistryEntry(kind)?.duplicateAllowed ?? true;
}
