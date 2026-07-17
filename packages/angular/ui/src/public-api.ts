/*
 * Public API Surface of @modyra/angular/ui.
 *
 * Angular UI primitives and built-in renderers for modyra forms.
 * This entry point intentionally excludes headless adapter contracts.
 *
 * NOTE: this secondary entrypoint re-exports from @modyra/angular
 * intentionally. ng-packagr secondary builds enforce rootDir boundaries,
 * so direct imports from ../../src/... are not viable here.
 */

// Form containers
export {
    MdyDynamicFormComponent,
    MdyFormArrayComponent,
    MdyFormComponent,
    MdyFormWizardComponent,
    MdyWizardStepComponent
} from "@modyra/angular";

// Control base and directives
export {
    MDY_FLOATING_LABELS,
    MdyBaseControl,
    MdyChipsDirective,
    MdyConditionalOptionsDirective,
    MdyControlComponent,
    MdyControlLabelComponent,
    MdyErrorListComponent,
    MdyFloatingLabelsDirective,
    MdyGlassDirective,
    MdyInlineErrorIconComponent,
    MdyInlineErrorsDirective,
    MdyLoadOptionsDirective,
    MdyOptionDirective,
    MdyOptionsAutoLoadingDirective,
    MdyOptionsOverlayControl,
    MdyOverlayControl,
    MdyPrefixDirective,
    MdySuffixDirective,
    MdySupportingTextDirective
} from "@modyra/angular";
export type { MdyOptionsLoader } from "@modyra/angular";

// Built-in renderers
export {
    MdyCalendarCellComponent,
    MdyCalendarComponent,
    MdyCalendarGridComponent,
    MdyCalendarHeaderComponent,
    MdyCheckboxComponent,
    MdyColorsComponent,
    MdyDatePickerComponent,
    MdyDateRangePickerComponent,
    MdyFileComponent,
    MdyMultiselectComponent,
    MdyNumberComponent,
    MdyRadioGroupComponent,
    MdyRangeCalendarComponent,
    MdyRangeCalendarGridComponent,
    MdySegmentedButtonComponent,
    MdySelectComponent,
    MdySliderComponent,
    MdyTextareaComponent,
    MdyTextComponent,
    MdyTimepickerComponent,
    MdyToggleComponent
} from "@modyra/angular";

// Devtools
export {
    MDY_DEVTOOLS_HOTKEY,
    MdyDevtoolsDirective,
    MdyFormsDevtoolsComponent,
    MdyFormsDevtoolsOverlayComponent,
    MdyFormsDevtoolsService
} from "@modyra/angular";

// Misc UI helpers
export { MdyA11yAnnouncer, MdyIconComponent } from "@modyra/angular";

// Declarative validator directives
export {
    MdyDisabledDirective,
    MdyEmailDirective,
    MdyMaxDirective,
    MdyMaxLengthDirective,
    MdyMinDirective,
    MdyMinLengthDirective,
    MdyPatternDirective,
    MdyRequiredDirective,
    MdyValidatorBaseDirective
} from "@modyra/angular";

