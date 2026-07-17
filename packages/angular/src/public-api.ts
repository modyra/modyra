/**
 * Public API Surface of modyra
 *
 * Core components and utilities for signal-driven forms.
 * The state engine is built entirely on native Angular signals —
 * no dependency on @angular/forms or RxJS.
 *
 * Naming convention: all exported symbols use the Mdy prefix.
 */

// ─── Core types ──────────────────────────────────────────────────────────────
export type {
  // Validator
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  // Control / renderer helpers
  MdyControlOption,
  MdyControlRendererConfig,
  // Date range
  MdyDateRange,
  MdyFieldConfig,
  MdyFieldError,
  MdyFieldRef,
  // Field-level
  MdyFieldState,
  MdyFieldTree,
  MdyFormAdapter,
  // Form context (optional)
  MdyFormContext,
  // Form-level
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent, MdyFormValidatorFn, MdyOptionsControl,
  MdySelectOption,
  MdySubmitMode, ValidatorFn
} from "./lib/core/types";

// ─── DI tokens ────────────────────────────────────────────────────────────────
export {
  MDY_DECLARATIVE_REGISTRY,
  MDY_FLOATING_LABELS_DEFAULT,
  MDY_FLOATING_LABELS_DENSITY_DEFAULT,
  MDY_FORM_ADAPTER,
  MDY_INLINE_ERRORS
} from "./lib/core/tokens";

// ─── UI string i18n ──────────────────────────────────────────────────────────
export { MDY_I18N_MESSAGES } from "./lib/core/i18n";
export {
  provideModyraLocale
} from "./lib/core/i18n-locales";
export type { MdyLocaleOptions } from "./lib/core/i18n-locales";

// ─── Date locale (i18n) ──────────────────────────────────────────────────────
// Only Angular DI wiring stays in this package. Locale builders/types live in @modyra/core.
export { MDY_DATE_LOCALE } from "./lib/core/date-locale";

// ─── Declarative adapter ──────────────────────────────────────────────────────
export { MdyDeclarativeAdapter } from "./lib/core/declarative-form-adapter";
export type { MdyDeclarativeRegistry } from "./lib/core/declarative-form-adapter";

// ─── Typed form (mdyForm) ─────────────────────────────────────────────────────
export { field, group, mdyForm, MdyTypedForm } from "./lib/core/typed-form";
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
  MdyTypedFormLike
} from "./lib/core/typed-form";

// ─── Form component ───────────────────────────────────────────────────────────
export { MdyFormArrayComponent } from "./lib/form-array/mdy-form-array.component";
export { MdyFormComponent } from "./lib/form/mdy-form.component";

// ─── Devtools ─────────────────────────────────────────────────────────────────
export { MdyDevtoolsDirective } from "./lib/devtools/mdy-devtools.directive";
export { MdyFormsDevtoolsOverlayComponent } from "./lib/devtools/mdy-forms-devtools-overlay.component";
export { MdyFormsDevtoolsComponent } from "./lib/devtools/mdy-forms-devtools.component";
export {
  MDY_DEVTOOLS_HOTKEY, MdyFormsDevtoolsService
} from "./lib/devtools/mdy-forms-devtools.service";

// ─── Dynamic forms ────────────────────────────────────────────────────────────
export { MdyDynamicFormComponent } from "./lib/dynamic/mdy-dynamic-form.component";

// ─── Wizard ───────────────────────────────────────────────────────────────────
export { MdyFormWizardComponent } from "./lib/wizard/mdy-form-wizard.component";
export { MdyWizardStepComponent } from "./lib/wizard/mdy-wizard-step.component";

// ─── Draft persistence ────────────────────────────────────────────────────────
export type {
  MdyDraftOptions,
  MdyDraftStorage
} from "./lib/core/declarative-form-adapter";

// ─── Control base class & optional wrapper ───────────────────────────────────
export { MdyChipsDirective } from "./lib/control/chips.directive";
export { MdyConditionalOptionsDirective } from "./lib/control/conditional-options.directive";
export { MdyControlComponent } from "./lib/control/control.component";
export { MdyBaseControl } from "./lib/control/control.directive";
export { MdyErrorListComponent } from "./lib/control/error-list.component";
export { MdyInlineErrorIconComponent } from "./lib/control/inline-error-icon.component";
export { MdyInlineErrorsDirective } from "./lib/control/inline-errors.directive";
export { MdyControlLabelComponent } from "./lib/control/mdy-control-label.component";
export { MdyOptionDirective } from "./lib/control/option.directive";
export { MdyPrefixDirective } from "./lib/control/prefix.directive";
export { MdySuffixDirective } from "./lib/control/suffix.directive";
export { MdySupportingTextDirective } from "./lib/control/supporting-text.directive";
export { MdyOptionsAutoLoadingDirective } from "./lib/core/directives/auto-loading.directive";
export { MdyGlassDirective } from "./lib/core/directives/glass.directive";
export { MdyLoadOptionsDirective } from "./lib/core/directives/load-options.directive";
export type { MdyOptionsLoader } from "./lib/core/directives/load-options.directive";
export { MdyOptionsOverlayControl } from "./lib/core/options-overlay-control.directive";
export { MdyOverlayControl } from "./lib/core/overlay-control.directive";
export { MDY_FLOATING_LABELS } from "./lib/core/tokens";
export { MdyFloatingLabelsDirective } from "./lib/form/mdy-floating-labels.directive";

// ─── Built-in renderer components ────────────────────────────────────────────
export { MdyCheckboxComponent } from "./lib/renderers/checkbox/checkbox-renderer.component";
export { MdyColorsComponent } from "./lib/renderers/colors/colors-renderer.component";
export { MdyCalendarCellComponent } from "./lib/renderers/datepicker/calendar-cell.component";
export { MdyCalendarGridComponent } from "./lib/renderers/datepicker/calendar-grid.component";
export { MdyCalendarHeaderComponent } from "./lib/renderers/datepicker/calendar-header.component";
export { MdyCalendarComponent } from "./lib/renderers/datepicker/calendar.component";
export { MdyDatePickerComponent } from "./lib/renderers/datepicker/datepicker.component";
export { MdyDateRangePickerComponent } from "./lib/renderers/datepicker/daterange-renderer.component";
export { MdyRangeCalendarGridComponent } from "./lib/renderers/datepicker/range-calendar-grid.component";
export { MdyRangeCalendarComponent } from "./lib/renderers/datepicker/range-calendar.component";
export { MdyFileComponent } from "./lib/renderers/file/file-renderer.component";
export { MdyMultiselectComponent } from "./lib/renderers/multiselect/multiselect-renderer.component";
export { MdyNumberComponent } from "./lib/renderers/number/number-renderer.component";
export { MdyRadioGroupComponent } from "./lib/renderers/radio/radio-group-renderer.component";
export { MdySegmentedButtonComponent } from "./lib/renderers/segmented-button/segmented-button-renderer.component";
export { MdySelectComponent } from "./lib/renderers/select/select-renderer.component";
export { MdySliderComponent } from "./lib/renderers/slider/slider-renderer.component";
export { MdyTextComponent } from "./lib/renderers/text/text-renderer.component";
export { MdyTextareaComponent } from "./lib/renderers/textarea/textarea-renderer.component";
export { MdyToggleComponent } from "./lib/renderers/toggle/toggle-renderer.component";


// Timepicker (Material 3)
export { MdyTimepickerComponent } from "./lib/renderers/timepicker";

// ─── Icon system ─────────────────────────────────────────────────────────────
export { MdyIconComponent } from "./lib/control/mdy-icon.component";

// Utilities
export { MdyA11yAnnouncer } from "./lib/core/a11y-announcer";

// ─── Declarative validator directives ────────────────────────────────────────
export {
  MdyDisabledDirective, MdyEmailDirective,
  MdyMaxDirective,
  MdyMaxLengthDirective,
  MdyMinDirective,
  MdyMinLengthDirective,
  MdyPatternDirective,
  MdyRequiredDirective,
  MdyValidatorBaseDirective
} from "./lib/validators/directives";

// ─── Angular forms/signals validator re-exports (schema-level) ───────────────
// These are currently not exposed as they were tied to the legacy adapter.
// Declarative validators are preferred via directives.

// ─── Framework-agnostic engine binding ────────────────────────────────────────
// The form engine lives in @modyra/core; this binds it to Angular signals.
export { angularReactivity } from "./lib/core/reactivity-angular";

// ─── Widget runtime ───────────────────────────────────────────────────────────
// Headless widget controllers from @modyra/widgets bound to Angular lifecycle.
export { MdyWidgetRuntime } from "./lib/widget-runtime/widget-runtime";
export type {
  MdyAngularCommandHandlers,
  MdyElementRefMap,
  MdyItemRefLookup,
} from "./lib/widget-runtime/widget-runtime";
export { MdyAngularSelectAdapter } from "./lib/widget-runtime/select-adapter";
export type {
  MdyAngularSelectAdapterOptions,
} from "./lib/widget-runtime/select-adapter";
