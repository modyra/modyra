/**
 * The seventeen definitions: what each kind is made of.
 *
 * Data, and nothing else. The DSL that reads like a function call here — `define(...)` — lives in
 * `define.ts` with the tables it consults, so this file can be read as the answer to "what is a
 * datepicker" without also being the answer to "how is a definition assembled".
 */
import { MDY_CHIP_CLASSES } from "../chip.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import {
  CALENDAR_CELL_STATES,
  CALENDAR_PERIOD_CELL_STATES,
  define,
  MDY_POPUP_CLASS,
  MDY_POPUP_SURFACE_CLASS,
  PARENT_CANDIDATES,
  POPUP_PLACEMENT_STATES,
  SHARED_STATES,
  SHELL_CLASS_FALLBACK,
} from "./define.js";
import { MDY_WIDGET_KINDS, MdyWidgetKind } from "./kinds.js";

export const MDY_WIDGET_CONTRACTS = Object.freeze({
  text: define("text", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { controlType: "text" }),
  email: define("email", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { controlType: "email" }),
  // The one kind whose meaning is what the control does: it conceals what is typed into it, and
  // nothing else separates it from a text field. Said here, an adapter has a statement to implement.
  password: define("password", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { controlType: "password", concealed: true }),
  textarea: define("textarea", ["mdy-renderer", "mdy-renderer--textarea"], ["root", "label", "requiredMarker", "inputWrapper", "control", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  // `increment` and `decrement` are the spin buttons an adapter may draw beside the input. Optional
  // because the native control already has its own and a renderer that leaves them to the platform
  // is complete without them — but declared, because one adapter draws them, they wear
  // `mdy-spin-btn`, and the themes style them. A part that is emitted and painted and named nowhere
  // is invisible to every audit here, all of which start from what the contract declares.
  number: define("number", ["mdy-renderer", "mdy-renderer--number"], ["root", "label", "requiredMarker", "inputWrapper", "control", "increment", "decrement", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { increment: ["mdy-spin-btn", "mdy-spin-btn-up"], decrement: ["mdy-spin-btn", "mdy-spin-btn-down"] },
      elements: { increment: "button", decrement: "button" } }),
  slider: define("slider", ["mdy-renderer", "mdy-renderer--slider"], ["root", "label", "requiredMarker", "track", "control", "value", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { track: ["mdy-slider-container"], control: ["mdy-slider"], value: ["mdy-slider-value"] } ,
      required: ["value"] }),
  // Boolean controls wrap their input and their text in one clickable element, so the label sits
  // inside the wrapper next to the control rather than above it.
  // `indicator` is the drawn box, the checkbox's answer to the toggle's track: a real element every
  // renderer emits, so a theme centres the tick inside it instead of guessing where the box sits
  // behind a label's pseudo-element.
  checkbox: define("checkbox", ["mdy-renderer", "mdy-renderer--checkbox"], ["root", "inputWrapper", "control", "indicator", "label", "requiredMarker", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper", indicator: "label" }, elements: { label: "label", inputWrapper: "container" }, classes: { inputWrapper: ["mdy-checkbox"], control: ["mdy-checkbox__control"], indicator: ["mdy-checkbox__indicator"], label: [MDY_FIELD_SHELL_CLASSES.label], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
      roles: { control: "checkbox" } ,
      required: ["indicator"] }),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "inputWrapper", "control", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper", track: "label" }, elements: { label: "label", inputWrapper: "container" }, classes: { inputWrapper: ["mdy-toggle"], control: ["mdy-toggle__control"], track: ["mdy-toggle__track"], thumb: ["mdy-toggle__thumb"], label: ["mdy-toggle__label"], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
      roles: { control: "switch" } ,
      required: ["thumb"] }),
  radio: define("radio", ["mdy-renderer", "mdy-renderer--radio-group"], ["root", "label", "requiredMarker", "group", "option", "optionControl", "optionLabel", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-radio-group"], option: ["mdy-radio-item"], optionControl: ["mdy-radio-circle"], optionLabel: ["mdy-radio-label"] },
      // A native chooser renders each choice as a <label> around its own <input type=radio>. That
      // is the accessible pattern and what every adapter emits; the ARIA `option` role belongs to a
      // listbox, which this is not.
      elements: { option: "label" },
      roles: { group: "radiogroup" } ,
      states: { group: ["horizontal"], option: ["disabled"] } ,
      required: ["option", "optionControl", "optionLabel"] }),
  segmented: define("segmented", ["mdy-renderer", "mdy-renderer--segmented"], ["root", "label", "requiredMarker", "group", "option", "optionControl", "optionCheck", "optionText", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-segmented"], option: ["mdy-segmented__button"], optionControl: ["mdy-segmented__control"], optionCheck: ["mdy-segmented__check"], optionText: ["mdy-segmented__text"] },
      // The same anatomy as `radio`, because it is the same control: a choice in a radiogroup. What
      // differs is how a theme paints it, which is not a matter for the contract.
      //
      // `option` is the labelled container and `optionControl` is the radio inside it. Naming both
      // is what lets the rule bite — a container alone can be anything, and a choice a pointer can
      // make but a screen reader cannot announce is what this kind used to permit.
      elements: { option: "label", optionControl: "radio" },
      roles: { group: "radiogroup" } ,
      states: { option: ["selected"] } ,
      presentation: ["mdy-segmented__button--first", "mdy-segmented__button--last"] ,
      required: ["option", "optionControl", "optionCheck", "optionText"] }),
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "placeholder", "arrow", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { trigger: ["mdy-select__trigger"], value: ["mdy-select__value"], placeholder: ["mdy-select__placeholder"], arrow: ["mdy-select__arrow"], popup: ["mdy-select__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], search: ["mdy-select__search"], listbox: ["mdy-select__list"], option: ["mdy-select__option"], loading: ["mdy-select__loader"], empty: ["mdy-select__empty"] },
      // `selected` is the value; `active` is where the keyboard is. They are genuinely different —
      // arrowing through a list moves `active` without changing what is chosen — and a renderer that
      // conflated them would make the list unnavigable for anyone not using a pointer.
      roles: { listbox: "listbox", option: "option" } ,
      states: { arrow: ["open"], trigger: ["open", "disabled", "readonly", "invalid", "loading"], listbox: ["open"], option: ["selected", "active", "hidden"], popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-select", "mdy-select__option-label"] ,
      // `listbox` is what the popup is for. A positioning box framing nothing is a coherent-looking
      // widget with nothing in it to choose from, and `empty` is a message *inside* the list rather
      // than a substitute for it.
      // Not `arrow` and not `placeholder`. A select that does not filter renders the **native**
      // chooser — deliberately, for the platform's typeahead and its mobile picker — and a native
      // `<select>` has no separate element for either: the arrow is the platform's own and the
      // placeholder is an `<option>`. Requiring them made a correct rendering fail, which is the
      // contract describing one of two presentations and calling the other broken.
      //
      // `listbox` stays required *of an open control*, which is the combobox path by construction:
      // a native chooser opens nothing this contract can see.
      required: ["listbox"] }),
  // Part order is the reading order, so it is decided here rather than inherited from the sequence
  // these names happen to be written in. What the control shows for the current selection comes
  // before the affordance that changes it: the chips, or the placeholder standing in for them while
  // nothing is chosen, then the header with its search button.
  // The option chips use the shared chip vocabulary — `mdy-chip` with a check, a label and, in
  // counter mode, the two step buttons and a count. That vocabulary is the contract, which is what
  // makes an option look the same whichever renderer drew it.
  // The anatomy: the options are chips in a grid *in the field*, and
  // the header's search button opens a popup holding the same grid over a filter box. A trigger
  // showing value chips (`chips`/`chip`/`placeholder`) is the compact alternative, so those parts
  // stay declared and optional. Which classes a chip carries is `multiselectChipClasses`, never a
  // string in a renderer.
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "inputWrapper", "box", "trigger", "chips", "chip", "chipRemove", "chipMove", "placeholder", "arrow", "announcement", "popup", "search", "options", "optionWrapper", "option", "optionCheck", "optionStep", "optionLabel", "optionCount", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { trigger: "inputWrapper", arrow: "trigger", options: "popup", optionWrapper: "options", option: "optionWrapper", chips: "trigger", chip: "chips", chipRemove: "chip", chipMove: "chip", placeholder: "trigger", announcement: "inputWrapper", search: "popup" },
      // This widget is a grid of chips, not a listbox, and the chip's element depends on the mode:
      // a <button> in toggle mode, a <div> carrying its own +/- step buttons in counter mode. The
      // contract has no way to say "this part's element depends on that option", so `option` is
      // declared unconstrained rather than asserting the half of it that a single-mode fixture
      // happens to show. A counter chip contains buttons, so it cannot itself be one.
      elements: { option: "presentation", options: "group" },
      // The popup frames a search field beside the chip grid, which is a composite a user enters,
      // works in and leaves — and the opener promises `dialog`. Declared here so the promise and
      // the thing promised come from one place: without a role on the part, nothing on screen
      // answered to what the opener announced.
      //
      // Not modal. The panel is anchored to its field and the page behind it stays reachable, so
      // `aria-modal` would say the opposite of what dismissal does.
      roles: { popup: "dialog" },
      states: { trigger: ["open", "disabled", "readonly", "invalid", "loading"], option: ["selected"], chip: ["selected", "removable"], popup: POPUP_PLACEMENT_STATES },
      classes: { box: ["mdy-multiselect"], trigger: ["mdy-multiselect__trigger"], arrow: ["mdy-multiselect__arrow"], options: ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"], optionWrapper: [MDY_CHIP_CLASSES.wrapper], option: [MDY_CHIP_CLASSES.block], optionCheck: [MDY_CHIP_CLASSES.check], optionLabel: [MDY_CHIP_CLASSES.label], optionCount: [MDY_CHIP_CLASSES.count], optionStep: [MDY_CHIP_CLASSES.step], chips: ["mdy-multiselect__chips"], chip: [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value], chipRemove: [MDY_CHIP_CLASSES.remove], chipMove: [MDY_CHIP_CLASSES.move], announcement: ["mdy-multiselect__announcement"], placeholder: ["mdy-multiselect__placeholder"], popup: ["mdy-multiselect__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS, "mdy-multiselect-overlay__panel"], search: ["mdy-multiselect-overlay__input"], loading: ["mdy-select__loader"], empty: ["mdy-multiselect-overlay__empty"] } ,
      // The two mode markers a chip carries. `--centered` reserves the width its tick will need in
      // toggle mode; `--counter` is the bag mode, whose chip has step buttons instead of a tick.
      presentation: ["mdy-chip--centered", "mdy-chip--counter"] ,
      // `optionCheck` is toggle mode's: a counter chip has a count between two steppers and no tick
      // to draw, so requiring it would ask every counter-mode renderer for an element that means
      // nothing there.
      // Keyed by `mode` on the field config, which already carries these two words. The option is a
      // different element in each: in `single` it *is* the control a user activates, in `multi` it
      // is the container the two steppers sit in — and a container that is itself a button would be
      // a button inside a button, which is neither valid nor what any renderer emits.
      variants: {
        single: { elements: { option: "button" }, required: ["optionCheck"] },
        multi: { elements: { option: "container" }, required: ["optionStep", "optionCount"] },
      } ,
      required: ["trigger", "chips", "announcement", "option", "optionLabel", "options"] }),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "monthPicker", "monthCell", "yearPicker", "yearCell", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { control: ["mdy-datepicker__input"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], monthPicker: ["mdy-datepicker__month-picker"], monthCell: ["mdy-datepicker__month-cell"], yearPicker: ["mdy-datepicker__year-picker"], yearCell: ["mdy-datepicker__year-cell"] },
      roles: { grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell", monthPicker: "grid", monthCell: "gridcell", yearPicker: "grid", yearCell: "gridcell" } ,
      states: { gridcell: CALENDAR_CELL_STATES, monthCell: CALENDAR_PERIOD_CELL_STATES, yearCell: CALENDAR_PERIOD_CELL_STATES, popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-datepicker", "mdy-datepicker__header-label", "mdy-datepicker__header-nav", "mdy-datepicker__icon", "mdy-datepicker__nav-btn", "mdy-datepicker__title", "mdy-datepicker__view-icon", "mdy-datepicker__view-toggle", "mdy-datepicker__year-grid", "mdy-datepicker__modal-header", "mdy-datepicker__modal-label", "mdy-datepicker__modal-value"] ,
      required: ["toggle", "calendar"] }),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "monthPicker", "monthCell", "yearPicker", "yearCell", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { startControl: ["mdy-datepicker__input", "mdy-daterange__input"], endControl: ["mdy-datepicker__input", "mdy-daterange__input"], separator: ["mdy-daterange__sep"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS, "mdy-datepicker__popup--range"], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], monthPicker: ["mdy-datepicker__month-picker"], monthCell: ["mdy-datepicker__month-cell"], yearPicker: ["mdy-datepicker__year-picker"], yearCell: ["mdy-datepicker__year-cell"] },
      roles: { grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell", monthPicker: "grid", monthCell: "gridcell", yearPicker: "grid", yearCell: "gridcell" } ,
      states: { gridcell: CALENDAR_CELL_STATES, monthCell: CALENDAR_PERIOD_CELL_STATES, yearCell: CALENDAR_PERIOD_CELL_STATES, popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-datepicker", "mdy-datepicker__header-label", "mdy-datepicker__header-nav", "mdy-datepicker__icon", "mdy-datepicker__nav-btn", "mdy-datepicker__title", "mdy-datepicker__view-icon", "mdy-datepicker__view-toggle", "mdy-daterange__group", "mdy-daterange__hint", "mdy-daterange__input-sizer", "mdy-datepicker__modal-header", "mdy-datepicker__modal-label", "mdy-datepicker__modal-value"] ,
      required: ["separator", "toggle", "calendar"] }),
  // The clock is the picker, and its anatomy is named here down to the hand and the numbers on the
  // face: a renderer that drew its own dial would be a different widget wearing the same classes,
  // and the foundation places a number from the `--index` it is given, not from where a renderer
  // decided to put it.
  timepicker: define("timepicker", ["mdy-renderer", "mdy-renderer--timepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialog", "container", "content", "header", "hour", "hourControl", "minute", "minuteControl", "period", "periodOption", "clock", "dialFace", "dialUnavailable", "dialUnavailableArc", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { dialog: "popup", header: "content", clock: "content", dialFace: "clock", dialHand: "dialFace", dialNumber: "dialFace", dialUnavailable: "dialFace", dialUnavailableArc: "dialUnavailable", content: "container", actions: "container", modeToggle: "actions", action: "actions", hourControl: "hour", minuteControl: "minute", periodOption: "period" },
      // `hour` and `minute` share `mdy-timepicker-segment`, so `active` — which of the two the dial
      // is currently editing — hangs off that shared base and is one rule in a theme, not two.
      states: { hour: ["active", "focused"], minute: ["active", "focused"], period: ["compact"], periodOption: ["selected"], hourControl: ["readonly"], minuteControl: ["readonly"], dialNumber: ["selected", "inner"], dialHand: ["ghost", "inner"], clock: ["animated"], action: ["confirm"], popup: POPUP_PLACEMENT_STATES },
      // The state lives on the segment and the semantics on the control inside it. `--active` is
      // which of the two the dial is editing, and it is painted on the container; the input carries
      // the accessible name and takes the typing. Moving either onto the other breaks the half that
      // is not moved.
      /* The one popup that takes no surface: this kind declares a `container`, and that container is
         the card. Dressing the popup as well puts a bordered box around a bordered box — the wrapper
         the surface split exists to remove — and gives the same content two scroll contexts. */
      classes: { control: ["mdy-timepicker__input"], toggle: ["mdy-timepicker__toggle"], popup: ["mdy-timepicker__popup", MDY_POPUP_CLASS], dialog: ["mdy-timepicker__dialog"], container: ["mdy-timepicker-container"], content: ["mdy-timepicker-content"], header: ["mdy-timepicker-header"], hour: ["mdy-timepicker-segment", "mdy-timepicker-segment--hour"], hourControl: ["mdy-timepicker-segment-input"], minute: ["mdy-timepicker-segment", "mdy-timepicker-segment--minute"], minuteControl: ["mdy-timepicker-segment-input"], period: ["mdy-timepicker-period-toggle"], periodOption: ["mdy-timepicker-period-btn"], clock: ["mdy-timepicker-dial"], dialFace: ["mdy-timepicker-dial__face"], dialHand: ["mdy-timepicker-dial__hand"], dialNumber: ["mdy-timepicker-dial__number"], dialUnavailable: ["mdy-timepicker-dial__unavailable-layer"], dialUnavailableArc: ["mdy-timepicker-dial__unavailable"], modeToggle: ["mdy-timepicker-mode-toggle"], actions: ["mdy-timepicker-actions"], action: ["mdy-timepicker-action-btn"] } ,
      presentation: ["mdy-timepicker", "mdy-timepicker--dial", "mdy-timepicker__icon", "mdy-timepicker-dial-variant", "mdy-timepicker-fields", "mdy-timepicker-segment-input--readonly", "mdy-timepicker-separator", "mdy-timepicker-spacer", "mdy-timepicker-segment-label"] ,
      // `container`, not `dialog`: the popup must frame the thing that holds the clock, and that is
      // the element both renderers build. Where the `dialog` role itself belongs is not settled —
      // one renderer puts it on the popup, the other on this container — so requiring the `dialog`
      // part would require an element neither of them draws.
      required: ["toggle", "container"] }),
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "fileList", "fileItem", "clear", "rejected", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { dropzone: ["mdy-file-container"], control: ["mdy-file-input"], content: ["mdy-file-content"], fileList: ["mdy-file-list"], fileItem: ["mdy-file-item"], clear: ["mdy-file-clear"], rejected: ["mdy-file-rejected"] },
      states: { dropzone: ["dragover"] } ,
      // What the field refused announces itself: it answers something the person just did, and a
      // `<div>` that appears in silence is evidence only for whoever is looking at it.
      roles: { rejected: "status" } ,
      // The name is what every renderer puts in the item; the meta line beside it — size, type — is
      // optional decoration that some do and some do not.
      presentation: ["mdy-file-icon", "mdy-file-info", "mdy-file-placeholder", "mdy-file-name", "mdy-file-meta"] ,
      required: ["content"] }),
  colors: define("colors", ["mdy-renderer", "mdy-renderer--colors"], ["root", "label", "requiredMarker", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle", "popup", "presets", "swatch", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { // The picker is the affordance a pointer uses to reach the colour, and the contract does not
      // say how a renderer builds one. A `<label>` wrapping the hidden `<input type=color>` and a
      // `<button>` beside it are both correct, and the second avoids nesting one focusable control
      // inside another — so requiring the first would mandate the weaker of the two.
      //
      // The native input is therefore a sibling under the wrapper rather than a child of the
      // picker: where it sits is a rendering choice, that it exists is the contract.
      elements: { nativePicker: "affordance" },
      roles: { presets: "listbox", swatch: "option" } ,
      states: { swatch: ["active"], popup: POPUP_PLACEMENT_STATES },
      classes: { nativePicker: ["mdy-colors__primary-picker"], preview: ["mdy-colors__preview-swatch"], control: ["mdy-colors__native-hidden"], hexInput: ["mdy-colors__hex-input"], toggle: ["mdy-colors__toggle-area"], popup: ["mdy-colors__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], presets: ["mdy-colors__presets"], swatch: ["mdy-color-swatch"] } ,
      presentation: ["mdy-colors", "mdy-colors__dropdown-header", "mdy-select__arrow"] ,
      required: ["hexInput", "nativePicker", "preview", "toggle", "presets"] }),
});

/**
 * Every part name any kind declares — the only names the tables above may be keyed by.
 *
 * These three tables are keyed by part and are **deliberately partial**: most parts need no parent
 * hint, are not shell parts, and carry no shell states, so a lookup that misses is an answer rather
 * than a mistake. `PART_SEMANTICS` can throw on a miss because every part must have a semantic;
 * these cannot, and typing them to a union is no better — the union would have to be derived from
 * the catalogue these tables help build.
 *
 * What is left to get wrong is the other direction: a **key naming a part that does not exist**.
 * A renamed or misspelled one goes on being looked up, never matching, and silently contributing
 * nothing — the parent hint stops applying, the shell class stops being inherited, and the widget
 * still renders, slightly differently, forever.
 *
 * So the check is on the keys, once, at load. It costs one pass over three small objects.
 */
const DECLARED_PART_NAMES: ReadonlySet<string> = new Set(
  MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].structure.nodes.map((node) => node.part as string)),
);

for (const [table, keys] of [
  ["PARENT_CANDIDATES", Object.keys(PARENT_CANDIDATES)],
  ["SHELL_CLASS_FALLBACK", Object.keys(SHELL_CLASS_FALLBACK)],
  ["MDY_SHELL_PART_STATES", Object.keys(SHARED_STATES)],
] as const) {
  const stale = keys.filter((key) => !DECLARED_PART_NAMES.has(key));
  if (stale.length > 0) {
    throw new RangeError(
      `[modyra] ${table} is keyed by part(s) no kind declares: ${stale.join(", ")}. `
      + `A key that matches nothing is looked up forever and contributes nothing — rename it to a `
      + `real part or delete it.`,
    );
  }
}

export type MdyWidgetPart<K extends MdyWidgetKind> = keyof (typeof MDY_WIDGET_CONTRACTS)[K]["parts"] & string;

/**
 * The kinds whose contract declares a `popup` part — the ones an overlay policy can be asked about.
 *
 * Derived from the catalog rather than listed, so a widget that gains or loses a popup changes this
 * by changing its own definition, and a caller asking `partClasses(kind, "popup")` for a checkbox
 * fails to compile instead of at runtime.
 */
export type MdyPopupWidgetKind = { [K in MdyWidgetKind]: "popup" extends MdyWidgetPart<K> ? K : never }[MdyWidgetKind];
export const MDY_CANONICAL_UI_CLASSES = Object.freeze([...new Set(MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].rootClasses))].sort());
