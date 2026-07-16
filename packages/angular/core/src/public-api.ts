/*
 * Public API Surface of @modyra/angular/core — the headless entry point.
 *
 * Exposes the form engine only: typed form model, declarative adapter,
 * validators, field/form state types, DI tokens, i18n and utilities — no
 * renderer components and no CSS. Teams with their own design system build
 * widgets on top of this; the primary entry point adds the M3/HIG renderer
 * catalog on the same engine.
 *
 * The symbols are re-exported from the primary entry point (same module
 * instances, same DI tokens): mixing `@modyra/angular/core` and
 * `@modyra/angular` imports in one app is safe.
 */

// ─── Typed form (mdyForm) ─────────────────────────────────────────────────────
export {
  field,
  group,
  mdyForm,
  MdyTypedForm,
} from "@modyra/angular";
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
} from "@modyra/angular";

// ─── Declarative adapter (engine) ─────────────────────────────────────────────
export { MdyDeclarativeAdapter } from "@modyra/angular";
export type { MdyDeclarativeRegistry } from "@modyra/angular";

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
} from "@modyra/angular";

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
} from "@modyra/angular";

// ─── i18n ─────────────────────────────────────────────────────────────────────
export {
  MDY_I18N_MESSAGES,
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  provideModyraLocale,
} from "@modyra/angular";
export type {
  MdyBuiltInLocale,
  MdyI18nMessages,
  MdyLocaleOptions,
} from "@modyra/angular";

// ─── Date / time / option utilities ──────────────────────────────────────────
export {
  filterOptionsByQuery,
  formatTimeAs,
  mdyFormSerialize,
  parse24Time,
  parseAnyTime,
  parseTime,
  to24Hour,
} from "@modyra/angular";
export type { MdyTimeFormat, ParsedTime } from "@modyra/angular";
