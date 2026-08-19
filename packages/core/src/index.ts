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

// `registerHandleOwner` is public because `observerFor` is: a registry with a public reader and a
// private writer means an adapter that builds a handle of its own cannot say which runtime owns it,
// and `observerFor` then falls back to a vanilla runtime whose signals that adapter cannot see —
// state changes and nothing re-renders, silently, which is the defect this registry exists to stop.
export {
  getFieldHandleOwner,
  handleFormOf,
  observerFor,
  registerHandleForm,
  registerHandleOwner,
} from "./reactive-owner.js";
export {
  MDY_VALIDATOR_FACTS,
  NO_CONSTRAINTS,
  factsOf,
  factsOfAll,
  mergeFacts,
  withFacts,
} from "./validator-facts.js";
export type { MdyFieldConstraints, MdyValidatorFacts } from "./validator-facts.js";

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
  MDY_DRAFT_KEY_IN_USE,
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

export type {
  MdyAsyncValidationContext,
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyControlOption,
  MdyDateRange,
  MdyFieldError,
  MdyFieldRef,
  MdyFieldState,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdyInteractivity,
  MdySelectOption,
  MdySubmitMode,
  ValidatorFn,
} from "./types.js";

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
  integer,
  valueShape,
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
  MdyWebStorageLike,
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
  MdyAnyRowDescriptor,
  MdyArrayDescriptor,
  MdyArrayHandle,
  MdyArrayItemValue,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyFieldOptions,
  MdyGroupOptions,
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

/**
 * What a field can be, stated once.
 *
 * The vocabulary is a leaf module rather than a constant inside the document parser, because a kind
 * is what a field *is* and not something a wire format owns.
 */
export { MDY_FIELD_KINDS } from "./field-kinds.js";
export type { MdyFieldKind } from "./field-kinds.js";

// ─── Dynamic forms (AI/CMS-declared configs) ─────────────────────────────────
//
// Named, not wildcarded. Four `export *` published seventy-four symbols nobody could read from the
// entry point, forty-seven of them from the least curated file in the package — so neither the type
// surface nor the coverage audit was measuring a surface anyone had chosen.
export {
  MDY_VALIDATION_MESSAGES,
  MDY_VALIDATION_MESSAGES_DEFAULT,
  validationMessagesForLocale,
} from "./validation-messages.js";
export type { MdyValidationMessages } from "./validation-messages.js";

export {
  MDY_MAX_EXPRESSION_DEPTH,
  evaluateExpression,
  evaluateRuleCondition,
  expressionContextKeys,
  expressionPaths,
  isContextRef,
  isExpression,
  isPathRef,
  isRootRef,
  isSelfRef,
  validateExpression,
} from "./expression.js";
export type {
  MdyContextRef,
  MdyExpression,
  MdyExpressionOp,
  MdyExpressionScope,
  MdyOperand,
  MdyPathRef,
  MdyRootRef,
  MdySelfRef,
} from "./expression.js";

export {
  MDY_DYNAMIC_DIAGNOSTICS,
  MDY_DYNAMIC_FIELD_KINDS,
  MDY_DYNAMIC_INVALID_FIELD,
  MDY_ID_DELIMITER,
  MDY_LAYOUT_MAX_DEPTH,
  assertNeverField,
  assertSafeDynamicFieldNames,
  buildDynamicFieldValidators,
  buildDynamicFormSchema,
  applyDynamicRules,
  buildDynamicValidations,
  buildDynamicValidators,
  flattenDynamicForm,
  flattenDynamicSchema,
  mdyEmptyValueFor,
  parseDynamicFields,
  parseDynamicForm,
} from "./dynamic-config.js";
export type {
  MdyDynamicArrayNode,
  MdyDynamicBooleanField,
  MdyDynamicBreakpoint,
  MdyDynamicCalendarOptions,
  MdyDynamicCollection,
  MdyDynamicColorsField,
  MdyDynamicColumns,
  MdyDynamicDateField,
  MdyDynamicDaterangeField,
  MdyDynamicDiagnostic,
  MdyDynamicField,
  MdyDynamicFieldNode,
  MdyDynamicFlatForm,
  MdyDynamicFileField,
  MdyDynamicFormConfig,
  MdyDynamicFormConfigV2,
  MdyDynamicFormConfigV3,
  MdyDynamicFormDocument,
  MdyDynamicFormParseResult,
  MdyDynamicGroupNode,
  MdyDynamicLayoutChild,
  MdyDynamicLayoutNode,
  MdyDynamicLayoutSlot,
  MdyDynamicNode,
  MdyDynamicNumberField,
  MdyDynamicOptionsField,
  MdyDynamicParseMode,
  MdyDynamicRecordNode,
  MdyDynamicRule,
  MdyDynamicRuleOperator,
  MdyDynamicSection,
  MdyDynamicSlotPlacement,
  MdyDynamicTextField,
  MdyDynamicValidation,
  MdyDynamicValidators,
  MdyMultiselectMode,
} from "./dynamic-config.js";

/**
 * A form from a flat field list — what a document over a wire produces, as against the nested node
 * `buildDynamicFormSchema` takes. Named for its input because that name used to mean both.
 */
export { applyFlatValidators, buildFlatFormSchema } from "./flat-schema.js";

export {
  MDY_VALUE_CONTRACTS,
  explainValueMismatch,
  matchesValueShape,
} from "./value-contracts.js";
export type {
  MdyValueCommit,
  MdyValueContract,
  MdyValueKind,
  MdyValueShape,
} from "./value-contracts.js";

// Satellite utilities (date/time, i18n, icons, keyboard, overlay positioning,
// serialize, devtools, options-utils) are deliberately absent from this entry.
// They live behind their own subpaths (@modyra/core/datetime, /localization,
// /ui, /serialize, /devtools, ...) so the main entry bundles only the form
// engine.
