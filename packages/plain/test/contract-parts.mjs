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
      return { ...shell, group: q(".mdy-radio-group, .mdy-segmented"), option: q(".mdy-plain-option-row"), optionControl: q('input[type="radio"]') };
    case "select":
      return { ...shell, trigger: q(".mdy-select__trigger"), arrow: q(".mdy-select__arrow") };
    case "multiselect":
      return { ...shell, trigger: q(".mdy-plain-multiselect"), chips: q(".mdy-multiselect"), chip: q(".mdy-multiselect__chip") };
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup"), grid: q(".mdy-datepicker__grid"), gridcell: q(".mdy-datepicker__cell") };
    case "timepicker":
      return { ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: q(".mdy-timepicker__popup"), hour: q(".mdy-timepicker__hour"), minute: q(".mdy-timepicker__minute") };
    case "daterange":
      return { ...shell, startControl: root.querySelectorAll('input[type="date"]')[0], endControl: root.querySelectorAll('input[type="date"]')[1] };
    case "file":
      return { ...shell, dropzone: q(".mdy-input-wrapper"), control: q('input[type="file"]') };
    case "slider":
      // Angular holds the range input in `.mdy-slider-container`; Plain's shell wrapper plays the
      // same part. The displayed value (`value`) is an optional part Plain does not render yet.
      return { ...shell, track: q(".mdy-input-wrapper"), control: q('input[type="range"]') };
    case "checkbox":
      return { ...shell, inputWrapper: q(".mdy-checkbox"), control: q("input") };
    case "toggle":
      return { ...shell, inputWrapper: q(".mdy-toggle"), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb"), control: q("input"), label: q(".mdy-toggle__label") };
    default:
      return { ...shell, control: q("input, textarea, select") };
  }
}

/**
 * Parts the widget owns but does not render in its initial, closed, error-free state. A closed
 * overlay's contents are absent by construction; listing them here is deliberate, not a waiver.
 */
export const ABSENT = {
  select: ["popup", "search", "listbox", "option", "loading", "empty"],
  multiselect: ["popup", "search", "searchButton", "listbox", "option", "loading", "empty"],
  datepicker: ["dialogHeader", "calendar", "actions"],
  timepicker: ["header", "period", "clock", "actions"],
  daterange: ["separator", "toggle", "popup", "calendar", "grid", "gridcell", "actions"],
  colors: ["toggle", "popup", "preview", "nativePicker", "hexInput", "presets", "swatch"],
  file: ["content", "fileList", "fileItem", "clear"],
};

/**
 * Structural parity gaps Plain still has against the contract, recorded rather than waived: the
 * conformance test asserts this map matches reality exactly, so a gap can neither appear silently
 * nor outlive its fix. Empty means every kind renders the contract's anatomy.
 */
export const KNOWN_DIVERGENCES = {};
