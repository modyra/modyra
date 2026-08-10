/**
 * @modyra/core — the framework-agnostic form engine.
 *
 * Typed field trees, sync/async/cross-field validation, dirty/touched
 * tracking, drafts, undo/redo and change tracking, all written against a
 * minimal reactive contract ({@link MdyReactivity}). A host binds that contract to whatever
 * reactive primitives it has; `vanillaReactivity()` runs the same engine in Node, CLIs and plain
 * unit tests.
 */
export {
  reactivityRunsEffects,
  vanillaReactivity
} from "./reactivity.js";
export type {
  MdyBatchingCapability,
  MdyComputedOptions,
  MdyEffectOptions,
  MdyEffectRef,
  MdyEqualityFn,
  MdyFlushCapability,
  MdyObserveCapability,
  MdyObserveOptions,
  MdyOnCleanup,
  MdyReactiveScope,
  MdyReactivity,
  MdyReactivityCapabilities,
  MdyScopeOptions,
  MdySignal,
  MdySignalOptions,
  MdyWritableSignal
} from "./reactivity.js";

export { getFieldHandleOwner } from "./reactive-owner.js";

export {
  MdyActivationError,
  MdyAdapterContractError,
  MdyCrossRuntimeObservationError,
  MdyDestroyedScopeError,
  MdyUnsupportedCapabilityError
} from "./reactivity-errors.js";

export {
  createConsoleDiagnostics,
  createSilentDiagnostics,
  MDY_ADAPTER_CONTRACT_VIOLATION,
  MDY_ASYNC_FEATURE_DISABLED,
  MDY_CROSS_RUNTIME_OBSERVATION,
  MDY_EFFECTS_UNAVAILABLE,
  MDY_SCOPE_DESTROYED,
  MDY_SSR_SNAPSHOT_MISMATCH,
  MDY_UNSUPPORTED_ADAPTER_OPTION
} from "./reactivity-diagnostics.js";
export type {
  MdyDiagnostic,
  MdyDiagnosticSeverity,
  MdyDiagnostics
} from "./reactivity-diagnostics.js";

export * from "./types.js";

export {
  completeRange,
  compose,
  composeFirst,
  crossField,
  eachOneOf,
  email,
  max,
  maxLength,
  MDY_MARKS_REQUIRED,
  MDY_NUMERIC_BOUND,
  integer,
  min,
  minLength,
  oneOf,
  pattern,
  required
} from "./validators.js";

export { serverValidator } from "./server-validator.js";
export type { MdyServerValidatorOptions } from "./server-validator.js";

export { isSafeFieldPath } from "./path-utils.js";
export { applyValueSecurity, draftShapeMatches } from "./security.js";
export type {
  MdySanitizer,
  MdySanitizeProfile,
  MdySecurityPolicy,
  MdySecurityViolation,
  MdySecurityViolationKind,
  MdyValueSecurityResult
} from "./security.js";
export { MdyFormEngine } from "./form-engine.js";
export type {
  MdyDraftOptions,
  MdyDraftStorage,
  MdyFormEngineOptions,
  MdyFormRegistry,
  MdyPathGate
} from "./form-engine.js";

export {
  array,
  createForm,
  field,
  group,
  MdyTypedForm,
  MdyTypedFormBase,
  record,
} from "./typed-form.js";
export type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyArrayDescriptor,
  MdyArrayHandle,
  MdyArrayItemValue,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyFieldOptions,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdySubmittedValue,
  MdyGroupDescriptor,
  MdyItemHandleTree,
  MdyRecordDescriptor,
  MdyRecordHandle,
  MdyTypedFormBaseOptions,
  MdyWiden
} from "./typed-form.js";

// ─── Dynamic forms (AI/CMS-declared configs) ─────────────────────────────────
export * from "./expression.js";
export * from "./dynamic-config.js";
export * from "./value-contracts.js";

// Satellite utilities (date/time, i18n, icons, keyboard, overlay positioning,
// serialize, devtools, options-utils) are deliberately absent from this entry.
// They live behind their own subpaths (@modyra/core/datetime, /localization,
// /ui, /serialize, /devtools, ...) so the main entry bundles only the form
// engine.
