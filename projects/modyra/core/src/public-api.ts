/*
 * Public API Surface of @modyra/forms/core — the headless entry point.
 *
 * Exposes the form engine only: typed form model, declarative adapter,
 * validators, field/form state types, DI tokens, i18n and utilities — no
 * renderer components and no CSS. Teams with their own design system build
 * widgets on top of this; the primary entry point adds the M3/HIG renderer
 * catalog on the same engine.
 *
 * The symbols are re-exported from the primary entry point (same module
 * instances, same DI tokens): mixing `@modyra/forms/core` and
 * `@modyra/forms` imports in one app is safe.
 */

// ─── Typed form (mdyForm) ─────────────────────────────────────────────────────
export {
  field,
  group,
  mdyForm,
  MdyTypedForm,
} from "@modyra/forms";
export type {
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyFieldDescriptor,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyFieldOptions,
  MdyFormOptions,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyTypedFormLike,
} from "@modyra/forms";

// ─── Declarative adapter (engine) ─────────────────────────────────────────────
export { MdyDeclarativeAdapter } from "@modyra/forms";
export type { MdyDeclarativeRegistry } from "@modyra/forms";

// ─── Core types ───────────────────────────────────────────────────────────────
export type {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyControlOption,
  MdyDateRange,
  MdyFieldConfig,
  MdyFieldError,
  MdyFieldRef,
  MdyFieldState,
  MdyFieldTree,
  MdyFormAdapter,
  MdyFormContext,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySelectOption,
  MdySubmitMode,
  ValidatorFn,
} from "@modyra/forms";

// ─── Validators ───────────────────────────────────────────────────────────────
export {
  crossField,
  mdyCompose,
  mdyComposeFirst,
  mdyEmail,
  mdyMax,
  mdyMaxLength,
  mdyMin,
  mdyMinLength,
  mdyPattern,
  mdyRequired,
  MDY_MARKS_REQUIRED,
} from "@modyra/forms";

// ─── i18n ─────────────────────────────────────────────────────────────────────
export {
  MDY_I18N_MESSAGES,
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  provideModyraLocale,
} from "@modyra/forms";
export type {
  MdyBuiltInLocale,
  MdyI18nMessages,
  MdyLocaleOptions,
} from "@modyra/forms";

// ─── Date / time / option utilities ──────────────────────────────────────────
export {
  filterOptionsByQuery,
  formatTimeAs,
  mdyFormSerialize,
  parse24Time,
  parseAnyTime,
  parseTime,
  to24Hour,
} from "@modyra/forms";
export type { MdyTimeFormat, ParsedTime } from "@modyra/forms";
