import { InjectionToken } from "@angular/core";

/**
 * All static UI strings used by modyra renderers.
 * Override by providing `MDY_I18N_MESSAGES` at the root or component level.
 *
 * @example
 * providers: [{ provide: MDY_I18N_MESSAGES, useValue: { ...MDY_I18N_MESSAGES_DEFAULT, noResults: 'Nessun risultato' } }]
 */
export interface MdyI18nMessages {
  readonly searchPlaceholder: string;
  readonly noResults: string;
  readonly colorPresetsHeader: string;
  readonly selectColorPrefix: string;
  readonly colorHexLabel: string;
  readonly timepickerOpenLabel: string;
  readonly timepickerCancel: string;
  readonly timepickerConfirm: string;
  readonly timepickerHourLabel: string;
  readonly timepickerMinuteLabel: string;
  readonly timepickerSwitchToDial: string;
  readonly timepickerSwitchToInput: string;
  readonly datepickerToggleLabel: string;
  readonly datepickerCancel: string;
  readonly datepickerConfirm: string;
  readonly datepickerSelectFallback: string;
  readonly datepickerChooseDate: string;
  readonly datepickerPreviousMonth: string;
  readonly datepickerNextMonth: string;
  /** aria-label of the month/year view toggle; receives "<month> <year>". */
  readonly datepickerChangeView: (current: string) => string;
  readonly daterangeChooseRange: string;
  readonly daterangeSelectFallback: string;
  readonly daterangeStartLabel: string;
  readonly daterangeEndLabel: string;
  readonly daterangePickStartHint: string;
  readonly daterangePickEndHint: string;
  readonly loading: string;
  readonly increase: string;
  readonly decrease: string;
  readonly searchOptionsLabel: string;
  readonly fileSelect: string;
  readonly fileSelectMultiple: string;
  readonly fileNoneSelected: string;
  readonly fileClearSelection: string;
  readonly overlayOpened: string;
  readonly overlayClosed: string;
  /** Label of the "create new option" row in a searchable select. */
  readonly selectCreateOption: (query: string) => string;
  readonly wizardNext: string;
  readonly wizardPrevious: string;
  readonly wizardFinish: string;
  /** a11y label of the wizard progress, e.g. "Step 2 of 4". */
  readonly wizardStepStatus: (current: number, total: number) => string;
}

/** Default English strings. Replace individual keys by spreading over this. */
export const MDY_I18N_MESSAGES_DEFAULT: MdyI18nMessages = {
  searchPlaceholder: "Search\u2026",
  noResults: "No results",
  colorPresetsHeader: "Presets",
  selectColorPrefix: "Select color",
  colorHexLabel: "Color hex value",
  timepickerOpenLabel: "Open time picker",
  timepickerCancel: "Cancel",
  timepickerConfirm: "OK",
  timepickerHourLabel: "Hour",
  timepickerMinuteLabel: "Minute",
  timepickerSwitchToDial: "Switch to dial view",
  timepickerSwitchToInput: "Switch to text input",
  datepickerToggleLabel: "Toggle calendar",
  datepickerCancel: "Cancel",
  datepickerConfirm: "OK",
  datepickerSelectFallback: "Select date",
  datepickerChooseDate: "Choose date",
  datepickerPreviousMonth: "Previous month",
  datepickerNextMonth: "Next month",
  datepickerChangeView: (current: string): string =>
    `Change view, currently ${current}`,
  daterangeChooseRange: "Choose date range",
  daterangeSelectFallback: "Select range",
  daterangeStartLabel: "Start date",
  daterangeEndLabel: "End date",
  daterangePickStartHint: "Click to set the start date",
  daterangePickEndHint: "Click to set the end date",
  loading: "Loading\u2026",
  increase: "Increase",
  decrease: "Decrease",
  searchOptionsLabel: "Search options",
  fileSelect: "Select file",
  fileSelectMultiple: "Select files",
  fileNoneSelected: "No file selected",
  fileClearSelection: "Clear selection",
  overlayOpened: "Popup opened",
  overlayClosed: "Popup closed",
  selectCreateOption: (query: string): string => `Create "${query}"`,
  wizardNext: "Next",
  wizardPrevious: "Back",
  wizardFinish: "Finish",
  wizardStepStatus: (current: number, total: number): string =>
    `Step ${current} of ${total}`,
} as const;

/**
 * DI token for UI string overrides.
 * Has a root-level factory so no explicit `provide` is needed for the defaults.
 */
export const MDY_I18N_MESSAGES = new InjectionToken<MdyI18nMessages>(
  "MDY_I18N_MESSAGES",
  { providedIn: "root", factory: () => MDY_I18N_MESSAGES_DEFAULT },
);
