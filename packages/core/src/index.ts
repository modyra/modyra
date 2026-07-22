/**
 * @modyra/core — the framework-agnostic form engine.
 *
 * Typed field trees, sync/async/cross-field validation, dirty/touched
 * tracking, drafts, undo/redo and change tracking, all written against a
 * minimal reactive contract ({@link MdyReactivity}). Framework packages
 * (e.g. `@modyra/angular` for Angular) bind that contract to their native
 * signals; `vanillaReactivity()` runs the same engine in Node, CLIs and
 * plain unit tests.
 */
export {
  vanillaReactivity
} from "./reactivity.js";
export type {
  MdyComputedOptions,
  MdyEffectOptions,
  MdyEffectRef,
  MdyEqualityFn,
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
  compose,
  composeFirst,
  crossField,
  eachOneOf,
  email,
  max,
  maxLength,
  MDY_MARKS_REQUIRED,
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
  MdyFormRegistry
} from "./form-engine.js";

export {
  array,
  createForm,
  field,
  group,
  MdyTypedForm,
  MdyTypedFormBase,
} from "./typed-form.js";
export type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
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
  MdyGroupDescriptor,
  MdyItemHandleTree,
  MdyTypedFormBaseOptions,
  MdyWiden
} from "./typed-form.js";

// ─── Dynamic forms (AI/CMS-declared configs) ─────────────────────────────────
export * from "./dynamic-config.js";

// NOTE: satellite utilities (date/time, i18n, icons, keyboard, overlay
// positioning, serialize, devtools, options-utils) are intentionally NOT
// re-exported here — import them from their subpath entries
// (@modyra/core/datetime, /localization, /ui, /serialize, /devtools, ...)
// so the main entry bundles only the form engine. See ROADMAP phase J.
