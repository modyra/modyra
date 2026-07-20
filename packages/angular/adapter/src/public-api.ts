/*
 * Public API Surface of @modyra/angular/adapter.
 *
 * Headless Angular bindings over the framework-agnostic core engine:
 * typed form model, declarative adapter, core form contracts and DI tokens.
 * No renderer components and no theme assets.
 *
 * NOTE: this secondary entrypoint re-exports from @modyra/angular
 * intentionally. ng-packagr secondary builds enforce rootDir boundaries,
 * so direct imports from ../../src/... are not viable here.
 */

// Typed form (mdyForm)
export {
    array,
    field,
    group,
    mdyForm,
    MdyTypedForm
} from "@modyra/angular";
export type {
    MdyAnyArrayDescriptor,
    MdyAnyFieldDescriptor,
    MdyAnyGroupDescriptor,
    MdyArrayDescriptor,
    MdyArrayHandle,
    MdyArrayItemValue,
    MdyFieldDescriptor,
    MdyFieldHandle,
    MdyFieldHandleTree,
    MdyFieldOptions,
    MdyFormOptions,
    MdyFormPatch,
    MdyFormSchema,
    MdyFormValue,
    MdyGroupDescriptor,
    MdyItemHandleTree,
    MdyTypedFormLike
} from "@modyra/angular";

// Declarative adapter
export { MdyDeclarativeAdapter } from "@modyra/angular";
export type { MdyDeclarativeRegistry } from "@modyra/angular";

// Core form types
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
    MdyOptionsControl,
    MdySelectOption,
    MdySubmitMode,
    ValidatorFn
} from "@modyra/angular";

// DI tokens
export {
    MDY_DECLARATIVE_REGISTRY,
    MDY_FLOATING_LABELS_DEFAULT,
    MDY_FLOATING_LABELS_DENSITY_DEFAULT,
    MDY_FORM_ADAPTER,
    MDY_INLINE_ERRORS
} from "@modyra/angular";

// i18n/date locale DI wiring
export {
    MDY_DATE_LOCALE,
    MDY_I18N_MESSAGES,
    provideModyraLocale
} from "@modyra/angular";
export type { MdyLocaleOptions } from "@modyra/angular";

// Draft persistence contracts
export type {
    MdyDraftOptions,
    MdyDraftStorage
} from "@modyra/angular";

// Angular reactivity bridge for core engine
export { angularReactivity } from "@modyra/angular";
