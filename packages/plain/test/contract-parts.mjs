/**
 * Shared map from contract parts to the elements Plain renders for them, plus the parts a widget
 * legitimately does not render in its initial closed, error-free state.
 */
const option = { value: "x", label: "X" };
export const FIELDS = [
  { name: "a", kind: "text", label: "A" },
  { name: "b", kind: "email", label: "B" },
  { name: "c", kind: "password", label: "C" },
  { name: "d", kind: "textarea", label: "D" },
  { name: "e", kind: "number", label: "E" },
  { name: "f", kind: "slider", label: "F" },
  { name: "g", kind: "checkbox", label: "G" },
  { name: "h", kind: "toggle", label: "H" },
  { name: "i", kind: "radio", label: "I", options: [option] },
  { name: "j", kind: "segmented", label: "J", options: [option] },
  { name: "k", kind: "select", label: "K", options: [option] },
  { name: "l", kind: "multiselect", label: "L", options: [option] },
  { name: "m", kind: "datepicker", label: "M" },
  { name: "n", kind: "timepicker", label: "N" },
  { name: "o", kind: "daterange", label: "O" },
  { name: "p", kind: "file", label: "P" },
  { name: "q", kind: "colors", label: "Q" },
];

/** Where each contract part lives in Plain's DOM, per kind. */
export function partsOf(root, kind) {
  const q = (selector) => root.querySelector(selector);
  const shell = {
    label: q(".mdy-label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper"),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
  switch (kind) {
    case "radio":
    case "segmented":
      return kind === "segmented"
        ? { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") }
        : { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    case "select": {
      const popup = document.querySelector(`#${root.querySelector(".mdy-select__trigger")?.getAttribute("aria-controls")}`)?.closest(".mdy-select__dropdown");
      return {
        ...shell, trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), arrow: q(".mdy-select__arrow"),
        popup, search: popup?.querySelector(".mdy-select__search"), listbox: popup?.querySelector(".mdy-select__list"), option: popup?.querySelector(".mdy-select__option"),
      };
    }
    case "multiselect": {
      // Same shape as select: the popup is portalled to <body>, reachable from the trigger's
      // `aria-controls` rather than from inside the renderer's own subtree.
      const popup = document.getElementById(q(".mdy-multiselect")?.getAttribute("aria-controls") ?? "");
      return {
        ...shell, trigger: q(".mdy-multiselect"), chips: q(".mdy-multiselect__chips"), chip: q(".mdy-chip"),
        placeholder: q(".mdy-multiselect__placeholder"),
        popup, search: popup?.querySelector(".mdy-multiselect-overlay__input"),
        listbox: popup?.querySelector(".mdy-multiselect__options"), option: popup?.querySelector(".mdy-chip--centered"),
        optionCheck: popup?.querySelector(".mdy-chip__check"), optionLabel: popup?.querySelector(".mdy-chip__label"),
      };
    }
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup"), grid: q(".mdy-datepicker__grid"), weekdays: q(".mdy-datepicker__weekdays"), weekday: q(".mdy-datepicker__weekday"), row: q(".mdy-datepicker__row"), gridcell: q(".mdy-datepicker__cell") };
    case "timepicker":
      return { ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: q(".mdy-timepicker__popup"), hour: q(".mdy-timepicker__hour"), minute: q(".mdy-timepicker__minute") };
    case "daterange": {
      const [start, end] = root.querySelectorAll(".mdy-daterange__input");
      return { ...shell, startControl: start, separator: q(".mdy-daterange__sep"), endControl: end, toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup"), grid: q(".mdy-datepicker__grid"), weekdays: q(".mdy-datepicker__weekdays"), weekday: q(".mdy-datepicker__weekday"), row: q(".mdy-datepicker__row"), gridcell: q(".mdy-datepicker__cell"), actions: q(".mdy-datepicker__actions") };
    }
    case "colors":
      return { ...shell, nativePicker: q(".mdy-colors__primary-picker"), preview: q(".mdy-colors__preview-swatch"), control: q(".mdy-colors__native-hidden"), hexInput: q(".mdy-colors__hex-input"), toggle: q(".mdy-colors__toggle-area"), popup: q(".mdy-colors__dropdown"), presets: q(".mdy-colors__presets"), swatch: q(".mdy-color-swatch") };
    case "file":
      return { ...shell, inputWrapper: null, dropzone: q(".mdy-file-container"), control: q(".mdy-file-input"), content: q(".mdy-file-content"), fileList: q(".mdy-file-list"), fileItem: q(".mdy-file-item"), clear: q(".mdy-file-clear") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "checkbox":
      return { ...shell, inputWrapper: q(".mdy-checkbox"), control: q(".mdy-checkbox__control"), indicator: q(".mdy-checkbox__indicator") };
    case "toggle":
      return { ...shell, inputWrapper: q(".mdy-toggle"), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb"), control: q(".mdy-toggle__control"), label: q(".mdy-toggle__label") };
    default:
      return { ...shell, control: q("input, textarea, select") };
  }
}

/**
 * Parts the widget owns but does not render in its initial, closed, error-free state. A closed
 * overlay's contents are absent by construction; listing them here is deliberate, not a waiver.
 */
export const ABSENT = {
  select: ["loading", "empty"],
  // No chip until something is selected, and the search button is select's affordance, not this
  // one's: the filter field is always present at the top of the popup.
  // No chip until something is selected; the count and the step buttons are counter mode's, and
  // the search button is select's affordance — this one's filter field is always in the popup.
  multiselect: ["chip", "searchButton", "optionCount", "optionStep", "loading", "empty"],
  datepicker: ["dialogHeader", "calendar", "actions"],
  timepicker: ["header", "period", "clock", "actions"],
  daterange: ["calendar"],
  colors: [],
  file: ["fileItem"],
};

/**
 * Structural parity gaps Plain still has against the contract, recorded rather than waived: the
 * conformance test asserts this map matches reality exactly, so a gap can neither appear silently
 * nor outlive its fix. Empty means every kind renders the contract's anatomy.
 */
export const KNOWN_DIVERGENCES = {};
