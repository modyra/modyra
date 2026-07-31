import { MDY_CHIP_CLASSES } from "./chip.js";
import type { MdyPartContract } from "./contract.js";
import type { MdyStateName } from "./state.js";
import { MDY_FIELD_SHELL_CLASSES } from "./structure.js";
import type { MdyWidgetSemanticElement, MdyWidgetStructure } from "./structure.js";

export const MDY_WIDGET_KINDS = ["text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle", "radio", "segmented", "select", "multiselect", "datepicker", "daterange", "timepicker", "file", "colors"] as const;
export type MdyWidgetKind = (typeof MDY_WIDGET_KINDS)[number];

export interface MdyWidgetDefinition<TPart extends string = string> {
  readonly kind: MdyWidgetKind;
  readonly rootClasses: readonly string[];
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
  readonly structure: MdyWidgetStructure<TPart | "root">;
  readonly capabilities: {
    readonly keyboard: boolean;
    readonly focus: boolean;
    readonly overlay: boolean;
    /** A pointer outside the overlay dismisses it. True wherever there is an overlay: a popup a
     * click elsewhere cannot dismiss is the exception, and would have to be declared as one. */
    readonly dismissOnOutsidePointer: boolean;
    /**
     * How this widget's popup attaches, for `anchorOverlay`. A list belongs under its control and
     * as wide as it; a calendar is sized by its own content. Naming it here is what stops three
     * renderers from each choosing a width for the same widget.
     */
    readonly anchoring?: {
      readonly matchAnchorWidth: boolean;
      readonly minSpace: number;
      readonly minWidth?: number;
      /**
       * The edge of the control the popup hangs from. Every widget here puts its trigger — the
       * arrow, the calendar button, the swatch — at the end of the control, so its popup opens from
       * that end and stays there: which corner a calendar opens from is a property of the widget,
       * not of where its field happens to sit on the page or where inside it you clicked. The
       * viewport can still overrule it when the content would not fit that side.
       */
      readonly alignment?: "left" | "right";
    };
  };
}

/**
 * Carried by a popup that a renderer lifts out of its field and positions against the viewport,
 * alongside {@link MDY_POPUP_CLASS}. The container is the same either way; this only says the
 * coordinates are viewport coordinates, which is what a portalled popup needs and a projected one
 * (Angular's CDK panel) must not have.
 */
export const MDY_OVERLAY_PORTAL_CLASS = "mdy-overlay";

function part(classes: readonly string[] = [], attributes: MdyPartContract["attributes"] = {}, states: readonly MdyStateName[] = []): MdyPartContract {
  return Object.freeze({ classes: Object.freeze([...classes]), attributes: Object.freeze({ ...attributes }), ...(states.length ? { states: Object.freeze([...states]) } : {}) });
}

/**
 * Carried by every `popup` part, whatever widget owns it.
 *
 * An overlay must never take part in layout: a popup left in flow resizes its field and pushes the
 * rest of the form down the page the moment it opens. Naming the guarantee in the contract — rather
 * than leaving each renderer and each theme to arrange it — is what makes it hold everywhere.
 */
export const MDY_POPUP_CLASS = "mdy-popup";

/**
 * Where each part hangs. Candidates are tried in order and the first one the widget actually
 * declares wins, so the same table serves a control with an input wrapper and one without.
 * The anatomy is nested rather than flat because containment is part of what an adapter must
 * reproduce: a control outside its wrapper is a different control.
 */
const PARENT_CANDIDATES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  requiredMarker: ["label"], inlineError: ["label"],
  prefix: ["inputWrapper"], suffix: ["inputWrapper"],
  control: ["dropzone", "inputWrapper", "track"], startControl: ["inputWrapper"], endControl: ["inputWrapper"], separator: ["inputWrapper"],
  decrement: ["inputWrapper"], increment: ["inputWrapper"], trigger: ["inputWrapper"], toggle: ["inputWrapper"],
  // The arrow may be drawn inside a button trigger (Angular, Lit) or beside an input one (Plain);
  // what the contract requires is that it lives in the wrapper, and containment is transitive.
  arrow: ["inputWrapper", "trigger"], value: ["trigger", "inputWrapper"], placeholder: ["trigger", "inputWrapper"],
  track: ["inputWrapper"], thumb: ["track"], chips: ["trigger"], chip: ["chips"], searchButton: ["trigger"],
  group: [], option: ["optionWrapper", "listbox", "options", "group"], optionControl: ["option"], optionLabel: ["option"], optionCheck: ["option"], optionText: ["option"], optionCount: ["option"], optionStep: ["option"],
  search: ["popup"], listbox: ["popup"], optionWrapper: ["options", "listbox"], options: ["root"], loading: ["popup"], empty: ["popup"],
  dialogHeader: ["popup"], header: ["popup"], calendar: ["popup"], clock: ["popup"], actions: ["popup"],
  grid: ["calendar", "popup"], weekdays: ["grid"], weekday: ["weekdays"], row: ["grid"], gridcell: ["row", "grid"],
  hour: ["header", "popup"], minute: ["header", "popup"], period: ["header", "popup"],
  preview: ["nativePicker", "inputWrapper"], nativePicker: ["inputWrapper"], hexInput: ["inputWrapper", "popup"], presets: ["popup"], swatch: ["presets"],
  content: ["dropzone"], fileList: ["dropzone"], fileItem: ["fileList"], clear: ["fileItem", "dropzone"],
  errorItem: ["errors"],
});
/** Parts an adapter must always render — the control, and whatever physically holds it. */
const REQUIRED_PARTS: ReadonlySet<string> = new Set(["control", "startControl", "endControl", "trigger", "group", "inputWrapper", "dropzone", "track"]);

/**
 * Parts a widget renders once per item rather than once. Everything else is singular, and that is
 * the point: without this line, "how many of these may there be" had no answer, so two controls
 * were as conforming as one. A part that repeats says so here; a part that does not, cannot.
 */
const REPEATED_PARTS: ReadonlySet<string> = new Set([
  "option", "optionWrapper", "optionLabel", "optionCheck", "optionStep", "optionCount",
  "errorItem", "chip", "gridcell", "row", "weekday", "swatch", "fileItem", "dialNumber", "action",
]);

/**
 * The class a shell part carries when its widget does not override it.
 *
 * `MDY_FIELD_SHELL_CLASSES` declared this vocabulary from the start and nothing checked it: every
 * shell part came out of `define()` with an empty class list, so `mdy-label` could be renamed to
 * anything and the conformance suite agreed. Declaring it here is what gives the existing
 * `PART_CLASS_MISSING` rule something to enforce.
 *
 * `control` is deliberately absent. The shell maps it to `mdy-input-wrapper__inliner`, which is the
 * box *around* the control rather than the control itself — requiring it of the `control` part would
 * assert something no renderer means.
 */
const SHELL_CLASS_FALLBACK: Readonly<Record<string, readonly string[]>> = Object.freeze({
  label: [MDY_FIELD_SHELL_CLASSES.label],
  requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker],
  inputWrapper: [MDY_FIELD_SHELL_CLASSES.inputWrapper],
  prefix: [MDY_FIELD_SHELL_CLASSES.prefix],
  suffix: [MDY_FIELD_SHELL_CLASSES.suffix],
  inlineError: [MDY_FIELD_SHELL_CLASSES.inlineError],
  supportingText: [MDY_FIELD_SHELL_CLASSES.supportingText],
  errors: [MDY_FIELD_SHELL_CLASSES.errors],
  errorItem: [MDY_FIELD_SHELL_CLASSES.errorItem],
});

/** Per-widget deviations from the shared tables: where a part hangs, and the class it carries. */
interface MdyWidgetShape {
  readonly parents?: Readonly<Record<string, string>>;
  readonly classes?: Readonly<Record<string, readonly string[]>>;
  /** States this widget's parts may be in, over and above {@link SHARED_STATES}. */
  readonly states?: Readonly<Record<string, readonly MdyStateName[]>>;
  /**
   * Semantic element overrides. A boolean control wraps its text in the `<label>` itself, so the
   * `label` *part* there is the text inside it — declaring it a `<label>` would ask a renderer for
   * a label inside a label, which is not valid HTML and not what any of them emit.
   */
  readonly elements?: Readonly<Record<string, MdyWidgetSemanticElement>>;
}

/**
 * States every field-like widget's shell parts share.
 *
 * The shell is the same shell whatever it wraps, so its states are declared once rather than
 * seventeen times: a wrapper is disabled or in error, a label is filled or has an error to make room
 * for, a root is open or has been touched.
 */
const SHARED_STATES: Readonly<Record<string, readonly MdyStateName[]>> = Object.freeze({
  root: ["open", "touched"],
  inputWrapper: ["disabled", "error"],
  label: ["filled", "hasError"],
  requiredMarker: ["filled"],
});

/**
 * The states a part ends up with: the widget's own if it declares any, otherwise the shell's — but
 * only where the part really is the shell's.
 *
 * A widget that gives a part a class of its own has made it a different part. A multiselect's
 * `inputWrapper` is `mdy-multiselect`, the grid of chips; handing it `mdy-input-wrapper`'s states
 * would mint `mdy-multiselect--disabled`, a class no theme has ever styled and no renderer has ever
 * emitted. The root is the exception, because every root carries `mdy-renderer` whatever else it
 * also carries.
 */
function statesFor(name: string, shape: MdyWidgetShape): readonly MdyStateName[] {
  const own = shape.states?.[name];
  if (own) return own;
  if (name !== "root" && shape.classes?.[name] !== undefined) return [];
  return SHARED_STATES[name] ?? [];
}

/**
 * Where the popup ended up, reflected onto the popup itself.
 *
 * `anchorOverlay` already decides this and writes the coordinates; the class is how a theme reacts
 * to the decision — an arrow that points down when the popup sits above, a shadow that lifts the
 * other way. Every popup declares the same two because it is the same decision for all of them:
 * "below" is the ordinary case and needs no class.
 */
const POPUP_PLACEMENT_STATES: readonly MdyStateName[] = Object.freeze(["above", "overlay"]);

/**
 * Everything a day in a calendar can be at once.
 *
 * A single cell is routinely several of these together — today, selected, and the start of a range —
 * which is why they are states rather than variants: they compose, and a theme paints each one
 * without knowing which others are on. Shared by the datepicker and the range picker, because a day
 * does not mean something different depending on how many dates the field collects.
 */
const CALENDAR_CELL_STATES: readonly MdyStateName[] = Object.freeze([
  "selected", "today", "outside", "disabled", "focused", "inRange", "rangeStart", "rangeEnd",
]);

/**
 * The part that opens each overlay, and therefore the part that must carry `aria-controls` naming
 * the popup and `aria-expanded` saying whether it is showing.
 *
 * Select and multiselect had this relation uniformly; the pickers and the colour field did not —
 * some popups had no id an `aria-controls` could name, and in the timepicker the element that opens
 * the dialog is a different element from the input under test. Declaring the opener is what turns
 * "some element around here has aria-controls" into a contract an adapter can be held to.
 *
 * `file` is absent deliberately: the browser owns its picker, so there is no overlay the contract
 * can observe and nothing to relate.
 */
export const MDY_POPUP_OPENERS: Readonly<Record<string, string>> = Object.freeze({
  select: "trigger",
  multiselect: "searchButton",
  datepicker: "toggle",
  daterange: "toggle",
  timepicker: "toggle",
  colors: "toggle",
});

/** Anchoring per kind; widgets with no overlay have none. */
// Every trigger in this catalog sits at the end of its control, so every popup hangs from that end.
// A list that matches its control's width covers both edges and looks the same either way; a
// content-sized popup does not, which is why declaring it is what stops the same calendar opening
// from the left corner on one form and the right corner on another.
const ANCHORING: Readonly<Record<string, { matchAnchorWidth: boolean; minSpace: number; minWidth?: number; alignment?: "left" | "right" }>> = Object.freeze({
  select: { matchAnchorWidth: true, minSpace: 180, minWidth: 160, alignment: "right" },
  multiselect: { matchAnchorWidth: true, minSpace: 180, minWidth: 160, alignment: "right" },
  datepicker: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  daterange: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  timepicker: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  colors: { matchAnchorWidth: false, minSpace: 120, minWidth: 280, alignment: "right" },
});

function define<const TPart extends string>(kind: MdyWidgetKind, rootClasses: readonly string[], partNames: readonly TPart[], overlay: boolean, shape: MdyWidgetShape = {}): MdyWidgetDefinition<TPart> {
  const partMap = Object.fromEntries(partNames.map((name) => [
    name,
    // A widget's own states replace the shell's rather than adding to them, so a part that means
    // something different here — a multiselect's `inputWrapper`, which is the chip grid — is not
    // silently given states it cannot be in.
    part(name === "root" ? rootClasses : shape.classes?.[name] ?? SHELL_CLASS_FALLBACK[name] ?? [], {}, statesFor(name, shape)),
  ])) as Record<TPart, MdyPartContract>;
  const declared = new Set<string>(partNames);
  const siblingCount = new Map<string, number>();
  const nodes = partNames.map((name) => {
    if (name === "root") return Object.freeze({ part: name, element: shape.elements?.[name] ?? semanticElement(name), order: 0, optional: false });
    const override = shape.parents?.[name];
    const parent = (override && declared.has(override) ? override : undefined)
      ?? (PARENT_CANDIDATES[name] ?? []).find((candidate) => declared.has(candidate)) ?? "root";
    const order = siblingCount.get(parent) ?? 0;
    siblingCount.set(parent, order + 1);
    return Object.freeze({ part: name, element: shape.elements?.[name] ?? semanticElement(name), parent: parent as TPart, order, optional: !REQUIRED_PARTS.has(name), repeated: REPEATED_PARTS.has(name) });
  });
  return Object.freeze({ kind, rootClasses: Object.freeze([...rootClasses]), parts: Object.freeze(partMap), structure: Object.freeze({ kind, nodes: Object.freeze(nodes) }), capabilities: Object.freeze({ keyboard: true, focus: true, overlay, dismissOnOutsidePointer: overlay, ...(overlay && ANCHORING[kind] ? { anchoring: Object.freeze(ANCHORING[kind]) } : {}) }) });
}
function semanticElement(partName: string) {
  const input = new Set(["control","startControl","endControl","search","hour","minute","hexInput","nativePicker"]);
  const button = new Set(["toggle","decrement","increment","searchButton","clear","modeToggle","action"]);
  if (partName === "root") return "root" as const; if (partName === "optionLabel") return "text" as const; if (partName === "label") return "label" as const; if (input.has(partName)) return "input" as const; if (button.has(partName)) return "button" as const; if (partName === "listbox") return "listbox" as const; if (partName === "option" || partName === "swatch") return "option" as const; if (["popup","calendar","clock"].includes(partName)) return "popup" as const; if (partName === "grid") return "grid" as const; if (partName === "gridcell") return "gridcell" as const; if (["errors","inlineError","loading","empty"].includes(partName)) return "status" as const; return "group" as const;
}

export const MDY_WIDGET_CONTRACTS = Object.freeze({
  text: define("text", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  email: define("email", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  password: define("password", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  textarea: define("textarea", ["mdy-renderer", "mdy-renderer--textarea"], ["root", "label", "requiredMarker", "inputWrapper", "control", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  number: define("number", ["mdy-renderer", "mdy-renderer--number"], ["root", "label", "requiredMarker", "inputWrapper", "control", "decrement", "increment", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  slider: define("slider", ["mdy-renderer", "mdy-renderer--slider"], ["root", "label", "requiredMarker", "track", "control", "value", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { track: ["mdy-slider-container"], control: ["mdy-slider"], value: ["mdy-slider-value"] } }),
  // Boolean controls wrap their input and their text in one clickable element, so the label sits
  // inside the wrapper next to the control rather than above it.
  // `indicator` is the drawn box, the checkbox's answer to the toggle's track: a real element every
  // renderer emits, so a theme centres the tick inside it instead of guessing where the box sits
  // behind a label's pseudo-element.
  checkbox: define("checkbox", ["mdy-renderer", "mdy-renderer--checkbox"], ["root", "inputWrapper", "control", "indicator", "label", "requiredMarker", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper", indicator: "inputWrapper" }, elements: { label: "text" }, classes: { inputWrapper: ["mdy-checkbox"], control: ["mdy-checkbox__control"], indicator: ["mdy-checkbox__indicator"], label: [MDY_FIELD_SHELL_CLASSES.label], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } }),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "inputWrapper", "control", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper" }, elements: { label: "text" }, classes: { inputWrapper: ["mdy-toggle"], control: ["mdy-toggle__control"], track: ["mdy-toggle__track"], thumb: ["mdy-toggle__thumb"], label: ["mdy-toggle__label"], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } }),
  radio: define("radio", ["mdy-renderer", "mdy-renderer--radio-group"], ["root", "label", "requiredMarker", "group", "option", "optionControl", "optionLabel", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-radio-group"], option: ["mdy-radio-item"], optionControl: ["mdy-radio-circle"], optionLabel: ["mdy-radio-label"] },
      // A native chooser renders each choice as a <label> around its own <input type=radio>. That
      // is the accessible pattern and what every adapter emits; the ARIA `option` role belongs to a
      // listbox, which this is not.
      elements: { option: "label" },
      states: { group: ["horizontal"], option: ["disabled"] } }),
  segmented: define("segmented", ["mdy-renderer", "mdy-renderer--segmented"], ["root", "label", "requiredMarker", "group", "option", "optionCheck", "optionText", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-segmented"], option: ["mdy-segmented__button"], optionCheck: ["mdy-segmented__check"], optionText: ["mdy-segmented__text"] },
      // Left unconstrained, and that is a finding rather than a preference. Plain renders each
      // choice as a <label> around an <input type=radio>, the same native pattern as radio; Angular
      // renders a <button>. Both are defensible — a radiogroup, or a toolbar of pressed buttons —
      // but they are not the same control to a screen reader, and the contract cannot require one
      // without breaking the other today. Task 16 (renderer equivalence) decides which; until it
      // does, declaring "either" honestly beats asserting a shape only one adapter meets.
      elements: { option: "presentation" },
      states: { option: ["selected"] } }),
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "placeholder", "arrow", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { trigger: ["mdy-select__trigger"], value: ["mdy-select__value"], placeholder: ["mdy-select__placeholder"], arrow: ["mdy-select__arrow"], popup: ["mdy-select__dropdown", MDY_POPUP_CLASS], search: ["mdy-select__search"], listbox: ["mdy-select__list"], option: ["mdy-select__option"], loading: ["mdy-select__loader"], empty: ["mdy-select__empty"] },
      // `selected` is the value; `active` is where the keyboard is. They are genuinely different —
      // arrowing through a list moves `active` without changing what is chosen — and a renderer that
      // conflated them would make the list unnavigable for anyone not using a pointer.
      states: { arrow: ["open"], option: ["selected", "active", "hidden"], popup: POPUP_PLACEMENT_STATES } }),
  // The option chips use the chip vocabulary the Angular renderer established — `mdy-chip` with a
  // check, a label and, in counter mode, the two step buttons and a count. That vocabulary is the
  // contract, which is what makes an option look the same whichever renderer drew it.
  // Angular's anatomy, which is the reference: the options are chips in a grid *in the field*, and
  // the header's search button opens a popup holding the same grid over a filter box. A trigger
  // showing value chips (`chips`/`chip`/`placeholder`) is the compact alternative, so those parts
  // stay declared and optional. Which classes a chip carries is `multiselectChipClasses`, never a
  // string in a renderer.
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "inputWrapper", "header", "searchButton", "options", "optionWrapper", "option", "optionCheck", "optionStep", "optionLabel", "optionCount", "chips", "chip", "placeholder", "popup", "search", "listbox", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { header: "inputWrapper", searchButton: "header", options: "root", optionWrapper: "options", option: "optionWrapper", chips: "inputWrapper", chip: "chips", placeholder: "inputWrapper", listbox: "popup", search: "popup" },
      // This widget is a grid of chips, not a listbox, and the chip's element depends on the mode:
      // a <button> in toggle mode, a <div> carrying its own +/- step buttons in counter mode. The
      // contract has no way to say "this part's element depends on that option", so `option` is
      // declared unconstrained rather than asserting the half of it that a single-mode fixture
      // happens to show — which is what it did until the demo, in counter mode, said otherwise.
      // Expressing per-mode anatomy is task 15's problem. Whether a multi-select should instead be
      // a listbox with aria-multiselectable is task 08's.
      elements: { option: "presentation", listbox: "group" },
      states: { option: ["selected"], chip: ["selected", "removable"], popup: POPUP_PLACEMENT_STATES },
      classes: { inputWrapper: ["mdy-multiselect"], header: ["mdy-multiselect__header"], searchButton: ["mdy-multiselect__search-btn"], options: ["mdy-multiselect__options"], optionWrapper: [MDY_CHIP_CLASSES.wrapper], option: [MDY_CHIP_CLASSES.block], optionCheck: [MDY_CHIP_CLASSES.check], optionLabel: [MDY_CHIP_CLASSES.label], optionCount: [MDY_CHIP_CLASSES.count], optionStep: [MDY_CHIP_CLASSES.step], chips: ["mdy-multiselect__chips"], chip: [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value], placeholder: ["mdy-multiselect__placeholder"], popup: ["mdy-multiselect__dropdown", MDY_POPUP_CLASS, "mdy-multiselect-overlay__panel"], search: ["mdy-multiselect-overlay__input"], listbox: ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"], loading: ["mdy-select__loader"], empty: ["mdy-multiselect-overlay__empty"] } }),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { control: ["mdy-datepicker__input"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] },
      states: { gridcell: CALENDAR_CELL_STATES, popup: POPUP_PLACEMENT_STATES } }),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { startControl: ["mdy-datepicker__input", "mdy-daterange__input"], endControl: ["mdy-datepicker__input", "mdy-daterange__input"], separator: ["mdy-daterange__sep"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, "mdy-datepicker__popup--range"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] },
      states: { gridcell: CALENDAR_CELL_STATES, popup: POPUP_PLACEMENT_STATES } }),
  // The clock is the picker, and its anatomy is named here down to the hand and the numbers on the
  // face: a renderer that drew its own dial would be a different widget wearing the same classes,
  // and the foundation places a number from the `--index` it is given, not from where a renderer
  // decided to put it.
  timepicker: define("timepicker", ["mdy-renderer", "mdy-renderer--timepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "container", "content", "header", "hour", "minute", "period", "clock", "dialFace", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { header: "content", clock: "content", dialFace: "clock", dialHand: "dialFace", dialNumber: "dialFace", content: "container", actions: "container", modeToggle: "actions", action: "actions" },
      // `hour` and `minute` share `mdy-timepicker-segment`, so `active` — which of the two the dial
      // is currently editing — hangs off that shared base and is one rule in a theme, not two.
      states: { hour: ["active"], minute: ["active"], period: ["compact"], dialNumber: ["selected", "inner"], action: ["confirm"], popup: POPUP_PLACEMENT_STATES },
      // The hour and minute *segments* are the containers the header lays out; each holds its own
      // <input type=number> with an aria-label. Declaring them inputs asked a renderer for a control
      // that is one level down and not a declared part at all — a gap task 08 should close by naming
      // the inner control, not one this batch papers over by widening the check.
      elements: { hour: "group", minute: "group" },
      classes: { control: ["mdy-timepicker__input"], toggle: ["mdy-timepicker__toggle"], popup: ["mdy-timepicker__popup", MDY_POPUP_CLASS], container: ["mdy-timepicker-container"], content: ["mdy-timepicker-content"], header: ["mdy-timepicker-header"], hour: ["mdy-timepicker-segment", "mdy-timepicker-segment--hour"], minute: ["mdy-timepicker-segment", "mdy-timepicker-segment--minute"], period: ["mdy-timepicker-period-toggle"], clock: ["mdy-timepicker-dial"], dialFace: ["mdy-timepicker-dial__face"], dialHand: ["mdy-timepicker-dial__hand"], dialNumber: ["mdy-timepicker-dial__number"], modeToggle: ["mdy-timepicker-mode-toggle"], actions: ["mdy-timepicker-actions"], action: ["mdy-timepicker-action-btn"] } }),
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "fileList", "fileItem", "clear", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { dropzone: ["mdy-file-container"], control: ["mdy-file-input"], content: ["mdy-file-content"], fileList: ["mdy-file-list"], fileItem: ["mdy-file-item"], clear: ["mdy-file-clear"] },
      states: { dropzone: ["dragover"] } }),
  colors: define("colors", ["mdy-renderer", "mdy-renderer--colors"], ["root", "label", "requiredMarker", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle", "popup", "presets", "swatch", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { control: "nativePicker" },
      // The picker is the <label> that wraps the hidden <input type=color>; the input is the
      // `control` part, declared right there in `parents`. Same shape as a boolean control.
      elements: { nativePicker: "label" },
      states: { swatch: ["active"], popup: POPUP_PLACEMENT_STATES },
      classes: { nativePicker: ["mdy-colors__primary-picker"], preview: ["mdy-colors__preview-swatch"], control: ["mdy-colors__native-hidden"], hexInput: ["mdy-colors__hex-input"], toggle: ["mdy-colors__toggle-area"], popup: ["mdy-colors__dropdown", MDY_POPUP_CLASS], presets: ["mdy-colors__presets"], swatch: ["mdy-color-swatch"] } }),
});

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
