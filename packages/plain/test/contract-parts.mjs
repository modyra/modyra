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
      // The field carries the header and its own grid of option chips; the popup is portalled to
      // <body> and holds the filter over the same grid, reachable from `aria-controls` on the
      // search button rather than from inside the renderer's own subtree.
      const searchButton = q(".mdy-multiselect__search-btn");
      const popup = document.getElementById(searchButton?.getAttribute("aria-controls") ?? "");
      const grid = root.querySelector(".mdy-multiselect__options:not(.mdy-multiselect-overlay__grid)");
      return {
        ...shell, inputWrapper: q(".mdy-multiselect"), header: q(".mdy-multiselect__header"), searchButton,
        options: grid, optionWrapper: grid?.querySelector(".mdy-chip-wrapper"), option: grid?.querySelector(".mdy-chip"),
        optionCheck: grid?.querySelector(".mdy-chip__check"), optionLabel: grid?.querySelector(".mdy-chip__label"),
        popup, search: popup?.querySelector(".mdy-multiselect-overlay__input"),
        listbox: popup?.querySelector(".mdy-multiselect-overlay__grid"),
      };
    }
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: q(".mdy-datepicker__popup"), grid: q(".mdy-datepicker__grid"), weekdays: q(".mdy-datepicker__weekdays"), weekday: q(".mdy-datepicker__weekday"), row: q(".mdy-datepicker__row"), gridcell: q(".mdy-datepicker__cell") };
    case "timepicker":
      return {
        ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: q(".mdy-timepicker__popup"),
        header: q(".mdy-timepicker-header"), period: q(".mdy-timepicker-period-toggle"), actions: q(".mdy-timepicker-actions"),
        container: q(".mdy-timepicker-container"), content: q(".mdy-timepicker-content"),
        clock: q(".mdy-timepicker-dial"), dialFace: q(".mdy-timepicker-dial__face"), dialHand: q(".mdy-timepicker-dial__hand"),
        // By modifier, not by document order: each segment is a container holding its own input,
        // so taking the first two elements paired the hour's container with the hour's input and
        // called the second one `minute`.
        hour: root.querySelector(".mdy-timepicker-segment--hour"),
        minute: root.querySelector(".mdy-timepicker-segment--minute"),
      };
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
      // Scoped to the wrapper the contract says holds the control, and returned as *every* match
      // rather than the first. `q("input, textarea, select")` found an input — any input, anywhere
      // in the root, a search box or a hidden native picker included — and handed back one of them,
      // so a renderer emitting two controls looked identical to one emitting the right single
      // control. Returning the set is what lets the cardinality rule see the difference.
      return {
        ...shell,
        control: Array.from(
          root.querySelectorAll(
            ".mdy-input-wrapper > input, .mdy-input-wrapper > textarea, .mdy-input-wrapper > select," +
              ".mdy-input-wrapper__inliner > input, .mdy-input-wrapper__inliner > textarea, .mdy-input-wrapper__inliner > select",
          ),
        ),
      };
  }
}

/**
 * Parts the widget owns but does not render in its initial, closed, error-free state. A closed
 * overlay's contents are absent by construction; listing them here is deliberate, not a waiver.
 */
export const ABSENT = {
  select: ["loading", "empty"],
  // The value chips and the placeholder belong to the compact trigger a renderer may show instead
  // of the field's own grid; this one shows the grid, as Angular does. The count and the steppers
  // are counter mode's.
  multiselect: ["chips", "chip", "placeholder", "optionCount", "optionStep", "loading", "empty"],
  datepicker: ["dialogHeader", "calendar", "actions"],
  // This used to read "no dial: this renderer types the time rather than drawing a clock face".
  // It does draw one — `timepicker-field.ts` builds the clock from the contract's own classes — and
  // the entry outlived the renderer that justified it. Nothing noticed, because `absentParts` was a
  // silencer: naming a part switched its checks off rather than asserting it was gone. Task 06
  // closed that, and this was the first thing it found.
  timepicker: [],
  daterange: ["calendar"],
  colors: [],
  file: ["fileItem"],
};

/**
 * Structural parity gaps Plain still has against the contract, recorded rather than waived: the
 * conformance test asserts this map matches reality exactly, so a gap can neither appear silently
 * nor outlive its fix. Empty means every kind renders the contract's anatomy.
 */
export const KNOWN_DIVERGENCES = {
  // Empty. F-08 is closed: every opener names the popup it opens, the relation select and
  // multiselect always had. Keep it empty — the assertion matches both ways, so a new divergence
  // fails and a stale entry fails too.
};
