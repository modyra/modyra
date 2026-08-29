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
  // `increment` and `decrement` are the spin buttons drawn beside the input. The native control has
  // its own and the foundation hides them, so these are the stepping affordance rather than a second
  // one: a renderer that draws neither leaves the kind with no way to step but the keyboard. They
  // wear `mdy-spin-btn` and the themes paint them.
  number: define("number", ["mdy-renderer", "mdy-renderer--number"], ["root", "label", "requiredMarker", "inputWrapper", "control", "increment", "decrement", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { increment: ["mdy-spin-btn", "mdy-spin-btn-up"], decrement: ["mdy-spin-btn", "mdy-spin-btn-down"] },
      // The box and its two steppers need one positioning context between them, and it is not a part:
      // nothing is announced by it and no contract member points at it.
      presentation: ["mdy-number-spinner"] ,
      elements: { increment: "button", decrement: "button" } }),
  slider: define("slider", ["mdy-renderer", "mdy-renderer--slider"], ["root", "label", "requiredMarker", "track", "control", "value", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { value: "track" },
      classes: { track: ["mdy-slider-container"], control: ["mdy-slider"], value: ["mdy-slider-value"] } ,
      required: ["value"] }),
  // Boolean controls wrap their input and their text in one clickable element, so the label sits
  // inside the wrapper next to the control rather than above it.
  // `indicator` is the drawn box, the checkbox's answer to the toggle's track: a real element every
  // renderer emits, so a theme centres the tick inside it instead of guessing where the box sits
  // behind a label's pseudo-element.
  checkbox: define("checkbox", ["mdy-renderer", "mdy-renderer--checkbox"], ["root", "inputWrapper", "control", "submitFalse", "indicator", "label", "requiredMarker", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper", indicator: "label", submitFalse: "inputWrapper" }, elements: { label: "label", inputWrapper: "container" }, classes: { inputWrapper: ["mdy-checkbox"], control: ["mdy-checkbox__control"], indicator: ["mdy-checkbox__indicator"], label: [MDY_FIELD_SHELL_CLASSES.label], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
      roles: { control: "checkbox" } ,
      required: ["indicator"] }),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "inputWrapper", "control", "submitFalse", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper", track: "label", submitFalse: "inputWrapper" }, elements: { label: "label", inputWrapper: "container" }, classes: { inputWrapper: ["mdy-toggle"], control: ["mdy-toggle__control"], track: ["mdy-toggle__track"], thumb: ["mdy-toggle__thumb"], label: ["mdy-toggle__label"], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
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
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "placeholder", "arrow", "popup", "search", "options", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { options: "popup" },
      classes: { trigger: ["mdy-select__trigger"], value: ["mdy-select__value"], placeholder: ["mdy-select__placeholder"], arrow: ["mdy-select__arrow"], popup: ["mdy-select__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], search: ["mdy-select__search"], options: ["mdy-select__list"], option: ["mdy-select__option"], loading: ["mdy-select__loader"], empty: ["mdy-select__empty"] },
      // `selected` is the value; `active` is where the keyboard is. They are genuinely different —
      // arrowing through a list moves `active` without changing what is chosen — and a renderer that
      // conflated them would make the list unnavigable for anyone not using a pointer.
      roles: { options: "listbox", option: "option" } ,
      // The list a select opens *is* a listbox, and the shared default for a part named `options` is
      // the chip grid's `group`. Declared here because the semantic is this kind's, not the name's.
      elements: { options: "listbox" } ,
      states: { arrow: ["open"], trigger: ["open", "disabled", "readonly", "invalid", "loading"], options: ["open"], option: ["selected", "active", "hidden", "disabled"], popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-select", "mdy-select__option-label"] ,
      // `options` is what the popup is for. A positioning box framing nothing is a coherent-looking
      // widget with nothing in it to choose from, and `empty` is a message *inside* the list rather
      // than a substitute for it.
      // Not `arrow` and not `placeholder`. A select that does not filter renders the **native**
      // chooser — deliberately, for the platform's typeahead and its mobile picker — and a native
      // `<select>` has no separate element for either: the arrow is the platform's own and the
      // placeholder is an `<option>`. Requiring them made a correct rendering fail, which is the
      // contract describing one of two presentations and calling the other broken.
      //
      // `options` stays required *of an open control*, which is the combobox path by construction:
      // a native chooser opens nothing this contract can see.
      required: ["options"],
      // The two shapes, declared rather than left to each renderer to infer from `searchable`.
      //
      // The prose above has said for a long time which parts a native `<select>` cannot have; said
      // only in prose, the anatomy still owed them to every select, so two renderers were reported
      // non-conforming for drawing exactly what this comment tells them to draw. A variant is how
      // this catalogue already says "one kind, two anatomies" — a multiselect's two modes use the
      // same mechanism — and the difference here is the same kind of difference.
      //
      // `custom` is the combobox: a trigger that holds the value, a mark that says it opens, a
      // placeholder in place of the value and an overlay for the opener relation to point at.
      // `native` is the platform's own chooser, where the chosen option is an `<option>`, the arrow
      // is the platform's, and nothing may carry `aria-expanded`, `aria-controls` or
      // `aria-haspopup` — a `<select>` that claims to be a combobox is lying about what it is.
      // `arrow` alone in the list, and that is not an oversight: a variant's `required` says *must be
      // there*, which overrides a presence condition rather than joining it. `value` and
      // `placeholder` already answer to what the field holds — one when there is a value, the other
      // when there is not — so demanding either of them here would ask a custom select showing its
      // placeholder for a value element it correctly does not draw. What the custom shape owes
      // unconditionally is the mark that says it opens; what the native shape owes is nothing, and
      // the three parts simply do not exist there.
      variants: {
        custom: { required: ["arrow"] },
        // What the platform's chooser makes of the two parts it does have: the trigger is the
        // `<select>` itself, and the placeholder is an `<option>` inside it rather than an element
        // beside the value. Declared, because a shape the contract does not describe is one every
        // check reports as broken.
        native: { required: [], elements: { trigger: "listbox", placeholder: "option" } },
      } }),
  // Part order is the reading order, so it is decided here rather than inherited from the sequence
  // these names happen to be written in. What the control shows for the current selection comes
  // before the affordance that changes it: the chips, or the placeholder standing in for them while
  // nothing is chosen, then the header with its search button.
  // At the trailing edge the two commands come before the caret: the way back first, then the
  // clear-all it reverses, then the mark that says the field opens.
  //
  // A command's position may depend on the field and never on the value. Standing them with the
  // chips put them after a row whose width is the length of what was chosen, so both slid every time
  // a value arrived or left — and a thumb aimed at the way back after a removal landed on the
  // clear-all, which discards everything. Proximity to the subject is a discoverability rule; not
  // moving under a hand is a safety rule, and where they disagree the safety rule decides.
  //
  // Only the commands are in an order — the caret is decoration, and it is drawn last because that
  // is where a person looks for it, not because it takes a place in a sequence.
  // The option chips use the shared chip vocabulary — `mdy-chip` with a check, a label and, in
  // counter mode, the two step buttons and a count. That vocabulary is the contract, which is what
  // makes an option look the same whichever renderer drew it.
  // The anatomy: the options are chips in a grid *in the field*, and
  // the header's search button opens a popup holding the same grid over a filter box. A trigger
  // showing value chips (`chips`/`chip`/`placeholder`) is the compact alternative, so those parts
  // stay declared and optional. Which classes a chip carries is `multiselectChipClasses`, never a
  // string in a renderer.
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "inputWrapper", "box", "chips", "chipRow", "chip", "chipMove", "chipRemove", "trigger", "placeholder", "overflowCount", "wayBackAction", "clearAll", "arrow", "announcement", "chipTooltip", "popup", "search", "options", "optionWrapper", "option", "optionCheck", "optionStep", "optionLabel", "optionCount", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { trigger: "box", arrow: "box", options: "popup", optionWrapper: "options", option: "optionWrapper", chips: "box", chipRow: "chips", chip: "chipRow", chipRemove: "chip", chipMove: "chip", chipTooltip: "box", placeholder: "trigger", overflowCount: "box", clearAll: "box", announcement: "box", wayBackAction: "box", search: "popup" },
      // This widget is a grid of chips, not a listbox, and the chip's element depends on the mode:
      // a <button> in toggle mode, a <div> carrying its own +/- step buttons in counter mode. The
      // contract has no way to say "this part's element depends on that option", so `option` is
      // declared unconstrained rather than asserting the half of it that a single-mode fixture
      // happens to show. A counter chip contains buttons, so it cannot itself be one.
      // Both new parts are buttons: a way back a person cannot press is not a way back, and a clear
      // that is not a button is a decoration. They stay out of `required` — a multiselect built
      // without a clear-all is still a multiselect — but a renderer that draws them draws these.
      elements: { option: "presentation", options: "group", clearAll: "button", overflowCount: "button", wayBackAction: "button" },
      // The popup frames a search field beside the chip grid, which is a composite a user enters,
      // works in and leaves — and the opener promises `dialog`. Declared here so the promise and
      // the thing promised come from one place: without a role on the part, nothing on screen
      // answered to what the opener announced.
      //
      // Not modal. The panel is anchored to its field and the page behind it stays reachable, so
      // `aria-modal` would say the opposite of what dismissal does.
      // The chip grid says what it is. It was left undeclared when the list stopped claiming
      // `listbox` semantics its chips did not have — the role was removed rather than corrected, so
      // the container became an unlabelled `div` and a screen reader was told nothing about the set
      // at all. Every renderer was already writing `role="group"` onto it, which is three answers to
      // a question the contract can answer once.
      //
      // `group` and not `listbox`: a listbox's children are options a person moves through with the
      // arrows, and these are chips that toggle. Naming the stronger role would promise a keyboard
      // model the grid does not have.
      // The full name of a chip whose label the strip had to cut. `title` is not an answer: it never
      // appears for a keyboard or a touch user, which is precisely who cannot widen the chip.
      // The strip is a grid and each chip is a cell of it, whatever the chip holds. A screen reader
      // switches between its two modes on the role of the focused element, and `listitem` — which
      // this was — is not one it switches on: somebody who arrived by browsing pressed an arrow, the
      // virtual cursor moved, focus stayed on the chip, and the strip's whole keyboard model never
      // reached them. Silently, and only on one of the two ways in. ADR 0148.
      //
      // `gridcell` carries `aria-posinset`/`aria-setsize`, which is what ADR 0127 pays for a row that
      // scrolls instead of wrapping, and it may contain buttons — which is what a chip is. `option`
      // switches too and is refused for its own reason: the listbox here is the popup a person
      // chooses from, and a strip of what was already chosen is not a second one.
      //
      // `always`, not only where a chip holds a quantity: a strip that changed role with its contents
      // would change its keyboard model underneath the person who filled it.
      roles: { options: "group", chips: "grid", chipRow: "row", chip: "gridcell", popup: "dialog", chipTooltip: "tooltip" },
      // The caret carries `open` for the same reason the single-choice sibling's does: which way it
      // points is the only thing on a closed control that says the list is showing, and it is not a
      // child of the control that holds the state, so nothing above it can turn it.
      // `clearAll` and `wayBackAction` are always drawn and say `disabled` where they cannot act: a
      // control that is part of a field's design does not come and go with what is in it, or the tab
      // stops move under the hands of whoever is using it. ADR 0171.
      states: { arrow: ["open"], trigger: ["open", "disabled", "readonly", "invalid", "loading"], option: ["selected", "active", "disabled"], chip: ["selected", "removable", "dragging"], clearAll: ["disabled"], wayBackAction: ["disabled"], popup: POPUP_PLACEMENT_STATES },

      classes: { box: ["mdy-multiselect"], trigger: ["mdy-multiselect__trigger"], arrow: ["mdy-multiselect__arrow"], options: ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"], optionWrapper: [MDY_CHIP_CLASSES.wrapper], option: [MDY_CHIP_CLASSES.block], optionCheck: [MDY_CHIP_CLASSES.check], optionLabel: [MDY_CHIP_CLASSES.label], optionCount: [MDY_CHIP_CLASSES.count], optionStep: [MDY_CHIP_CLASSES.step], chips: ["mdy-multiselect__chips"], chipRow: ["mdy-multiselect__chip-row"], chip: [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value], chipRemove: [MDY_CHIP_CLASSES.remove], chipMove: [MDY_CHIP_CLASSES.move], chipTooltip: ["mdy-chip__tooltip"], announcement: ["mdy-multiselect__announcement"], clearAll: ["mdy-multiselect__clear-all"], overflowCount: ["mdy-multiselect__overflow"], wayBackAction: ["mdy-multiselect__way-back-action"], placeholder: ["mdy-multiselect__placeholder"], popup: ["mdy-multiselect__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS, "mdy-multiselect-overlay__panel"], search: ["mdy-multiselect-overlay__input"], loading: ["mdy-select__loader"], empty: ["mdy-multiselect-overlay__empty"] } ,
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
        // A counter chip is a list item that holds a quantity, not a spinbutton: a control cannot be
        // both the item at position 3 of 12 and the number 3 of a range, and the role that takes the
        // position is the one this strip owes. The quantity is in the chip's own name and announced
        // when it changes.
        multi: {
          elements: { option: "container" },
          required: ["optionStep", "optionCount"],
        },
      } ,
      // `chips` is not among them: the strip is a grid, and a container for a set with no members is
      // not a smaller version of the set. `grid` requires rows and `row` requires cells, so a field
      // nobody has chosen anything in would announce contents it does not have. It appears with the
      // first value and goes with the last, and what says the field is empty is the field's own
      // placeholder. ADR 0148.
      // `clearAll` and `wayBackAction` among them: always drawn, unavailable only sometimes. A part a
      // renderer may leave out and one that is merely dimmed are different promises, and `optional`
      // is the word for the first. ADR 0171.
      required: ["trigger", "announcement", "option", "optionLabel", "options", "clearAll", "wayBackAction"] }),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "monthPicker", "monthCell", "yearPicker", "yearCell", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { control: ["mdy-datepicker__input"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], monthPicker: ["mdy-datepicker__month-picker"], monthCell: ["mdy-datepicker__month-cell"], yearPicker: ["mdy-datepicker__year-picker"], yearCell: ["mdy-datepicker__year-cell"] },
      // The calendar is the `dialog` — not the popup around it. Two renderers write the role on the
      // calendar and one wrote it nowhere, while the catalogue said nothing at all, so a role two
      // adapters agree on was one nothing could check and the third had to guess at. It is the
      // calendar because that is the thing a person enters, works in and leaves; the popup is the
      // box that positions it, and the clock declares it on its own panel because there the panel
      // and the thing inside it are one.
      roles: { calendar: "dialog", grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell", monthPicker: "grid", monthCell: "gridcell", yearPicker: "grid", yearCell: "gridcell" } ,
      states: { gridcell: CALENDAR_CELL_STATES, monthCell: CALENDAR_PERIOD_CELL_STATES, yearCell: CALENDAR_PERIOD_CELL_STATES, popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-datepicker", "mdy-datepicker__header-label", "mdy-datepicker__header-nav", "mdy-datepicker__icon", "mdy-datepicker__nav-btn", "mdy-datepicker__title", "mdy-datepicker__view-icon", "mdy-datepicker__view-toggle", "mdy-datepicker__year-grid", "mdy-datepicker__modal-header", "mdy-datepicker__modal-label", "mdy-datepicker__modal-value"] ,
      required: ["toggle", "calendar"] }),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "monthPicker", "monthCell", "yearPicker", "yearCell", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { startControl: ["mdy-datepicker__input", "mdy-daterange__input", "mdy-daterange__input--start"], endControl: ["mdy-datepicker__input", "mdy-daterange__input", "mdy-daterange__input--end"], separator: ["mdy-daterange__sep"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS, "mdy-datepicker__popup--range"], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], monthPicker: ["mdy-datepicker__month-picker"], monthCell: ["mdy-datepicker__month-cell"], yearPicker: ["mdy-datepicker__year-picker"], yearCell: ["mdy-datepicker__year-cell"] },
      // The calendar is the `dialog` — not the popup around it. Two renderers write the role on the
      // calendar and one wrote it nowhere, while the catalogue said nothing at all, so a role two
      // adapters agree on was one nothing could check and the third had to guess at. It is the
      // calendar because that is the thing a person enters, works in and leaves; the popup is the
      // box that positions it, and the clock declares it on its own panel because there the panel
      // and the thing inside it are one.
      roles: { calendar: "dialog", grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell", monthPicker: "grid", monthCell: "gridcell", yearPicker: "grid", yearCell: "gridcell" } ,
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
      // The popup is the dialog: it holds a draft the field does not have yet, and the only way out
      // of it that keeps the draft is its own confirm button. A renderer deciding for itself whether
      // to say so decides it from its own placement — a panel drawn without a backdrop then had no
      // role at all, and a person was told a clock had appeared but never that the page behind it
      // was unavailable. Declared here, the answer is the same wherever the panel is drawn.
      // The two segments are spinbuttons: a number a person steps with the arrows, bounded, and
      // announcing what it holds. The projection has emitted the role since the segments existed and
      // this table did not carry it, so a checker reading the anatomy found a role nobody declared.
      roles: { popup: "dialog", hourControl: "spinbutton", minuteControl: "spinbutton" },
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
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "clear", "fileList", "fileItem", "rejected", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { fileList: "content", clear: "content", rejected: "content" },
      classes: { dropzone: ["mdy-file-container"], control: ["mdy-file-input"], content: ["mdy-file-content"], fileList: ["mdy-file-list"], fileItem: ["mdy-file-item"], clear: ["mdy-file-clear"], rejected: ["mdy-file-rejected"] },
      states: { dropzone: ["dragover"], clear: ["disabled"] } ,

      // What the field refused announces itself: it answers something the person just did, and a
      // `<div>` that appears in silence is evidence only for whoever is looking at it.
      roles: { rejected: "status" } ,
      // The name is what every renderer puts in the item; the meta line beside it — size, type — is
      // optional decoration that some do and some do not.
      // `mdy-file-remove` is the cross on one listed file, which is not the field's `clear` — that one
      // empties the field and there is one of it. A renderer that dressed the per-file crosses in
      // `clear`'s class had the contract's word for one control on a row of another, and no clear at
      // all. Presentation until the contract declares the per-file act, which is its own decision.
      presentation: ["mdy-file-icon", "mdy-file-info", "mdy-file-placeholder", "mdy-file-name", "mdy-file-meta", "mdy-file-remove"] ,
      // `clear` too: always drawn, unavailable only sometimes. ADR 0171.
      //
      // Before the list rather than after it: the list is as long as the value, so a control below it
      // sits wherever the last row ends and moves every time a file is added or taken away — under
      // the hand of somebody removing several, one at a time. It stands with the control that picks
      // files instead, which is the part of this field that does not change with what is in it.
      // ADR 0173.
      required: ["content", "clear"] }),
  colors: define("colors", ["mdy-renderer", "mdy-renderer--colors"], ["root", "label", "requiredMarker", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle", "popup", "presets", "swatch", "customEntry", "customTint", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    {
      // The picker is the affordance a pointer uses to reach the colour, and the contract does not
      // say how a renderer builds one. A `<label>` wrapping the hidden `<input type=color>` and a
      // `<button>` beside it are both correct, and the second avoids nesting one focusable control
      // inside another — so requiring the first would mandate the weaker of the two.
      //
      // The native input is therefore a sibling under the wrapper rather than a child of the
      // picker: where it sits is a rendering choice, that it exists is the contract.
      // In the popup, which is where it is drawn and where the sentence above puts it: after the
      // grid is a place inside the panel, not beside the field. Left undeclared it reads as a child
      // of the root, and a record that describes an anatomy the renderers do not build is a record
      // that will be believed by somebody who cannot see the page.
      parents: { customEntry: "popup", customTint: "customEntry" },
      // The door to the platform's chooser, and only that. It is a button and it is **not** a swatch:
      // a set has a total and a position within it, so a button inside the grid would announce
      // "thirteen of thirteen" over twelve colours, put a thing of another kind into the arrow walk,
      // and claim a role a listbox does not admit. It sits after the grid, where every menu that has
      // one puts its way out.
      //
      // A colour picked by hand is a `swatch` like the twelve — selectable, re-selectable, carrying
      // the selected mark when it is current. A square that were a door when empty and a colour when
      // full would do different things depending on how it was set: pressed full, either the chooser
      // opens and the tint cannot be re-picked, or it selects and the door is gone. ADR 0158.
      // The caret is a drawing here, where every other kind that has one makes it a command. The
      // filled square opens this panel, and a caret opening the same panel would be a second command
      // for one act: two names, two keyboard stops, two things to describe. It is out of the tab
      // order and out of the tree assistive technology reads — both, because leaving it in one of the
      // two hides it from whoever navigates by keyboard and keeps it for whoever reads the tree.
      // ADR 0159.
      // What the door previews, declared because it is what makes the door legible rather than a
      // detail of one theme's taste: without it the door is a line of text among ten colours, and
      // with it looking like a colour it needs a shape of its own to not be counted as an eleventh.
      elements: { nativePicker: "affordance", customEntry: "button", toggle: "presentation", customTint: "presentation" },
      roles: { presets: "listbox", swatch: "option" } ,
      states: { swatch: ["active"], popup: POPUP_PLACEMENT_STATES },
      classes: { nativePicker: ["mdy-colors__primary-picker"], preview: ["mdy-colors__preview-swatch"], control: ["mdy-colors__native-hidden"], hexInput: ["mdy-colors__hex-input"], toggle: ["mdy-colors__toggle-area"], customEntry: ["mdy-colors__custom-entry"], customTint: ["mdy-colors__custom-tint"], popup: ["mdy-colors__dropdown", MDY_POPUP_CLASS, MDY_POPUP_SURFACE_CLASS], presets: ["mdy-colors__presets"], swatch: ["mdy-color-swatch"] } ,
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
