import type { MdyPartContract } from "./contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "./structure.js";
import type { MdyWidgetStructure } from "./structure.js";

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

function part(classes: readonly string[] = [], attributes: MdyPartContract["attributes"] = {}): MdyPartContract { return Object.freeze({ classes: Object.freeze([...classes]), attributes: Object.freeze({ ...attributes }) }); }

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
  group: [], option: ["listbox", "group"], optionControl: ["option"], optionLabel: ["option"], optionCheck: ["option"], optionText: ["option"], optionCount: ["option"], optionStep: ["option"],
  search: ["popup"], listbox: ["popup"], loading: ["popup"], empty: ["popup"],
  dialogHeader: ["popup"], header: ["popup"], calendar: ["popup"], clock: ["popup"], actions: ["popup"],
  grid: ["calendar", "popup"], weekdays: ["grid"], weekday: ["weekdays"], row: ["grid"], gridcell: ["row", "grid"],
  hour: ["header", "popup"], minute: ["header", "popup"], period: ["header", "popup"],
  preview: ["nativePicker", "inputWrapper"], nativePicker: ["inputWrapper"], hexInput: ["inputWrapper", "popup"], presets: ["popup"], swatch: ["presets"],
  content: ["dropzone"], fileList: ["dropzone"], fileItem: ["fileList"], clear: ["fileItem", "dropzone"],
  errorItem: ["errors"],
});
/** Parts an adapter must always render — the control, and whatever physically holds it. */
const REQUIRED_PARTS: ReadonlySet<string> = new Set(["control", "startControl", "endControl", "trigger", "group", "inputWrapper", "dropzone", "track"]);

/** Per-widget deviations from the shared tables: where a part hangs, and the class it carries. */
interface MdyWidgetShape {
  readonly parents?: Readonly<Record<string, string>>;
  readonly classes?: Readonly<Record<string, readonly string[]>>;
}

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
  const partMap = Object.fromEntries(partNames.map((name) => [name, part(name === "root" ? rootClasses : shape.classes?.[name] ?? [], {})])) as Record<TPart, MdyPartContract>;
  const declared = new Set<string>(partNames);
  const siblingCount = new Map<string, number>();
  const nodes = partNames.map((name) => {
    if (name === "root") return Object.freeze({ part: name, element: semanticElement(name), order: 0, optional: false });
    const override = shape.parents?.[name];
    const parent = (override && declared.has(override) ? override : undefined)
      ?? (PARENT_CANDIDATES[name] ?? []).find((candidate) => declared.has(candidate)) ?? "root";
    const order = siblingCount.get(parent) ?? 0;
    siblingCount.set(parent, order + 1);
    return Object.freeze({ part: name, element: semanticElement(name), parent: parent as TPart, order, optional: !REQUIRED_PARTS.has(name) });
  });
  return Object.freeze({ kind, rootClasses: Object.freeze([...rootClasses]), parts: Object.freeze(partMap), structure: Object.freeze({ kind, nodes: Object.freeze(nodes) }), capabilities: Object.freeze({ keyboard: true, focus: true, overlay, dismissOnOutsidePointer: overlay, ...(overlay && ANCHORING[kind] ? { anchoring: Object.freeze(ANCHORING[kind]) } : {}) }) });
}
function semanticElement(partName: string) {
  const input = new Set(["control","startControl","endControl","search","hour","minute","hexInput","nativePicker"]);
  const button = new Set(["toggle","decrement","increment","searchButton","clear","modeToggle","action"]);
  if (partName === "root") return "root" as const; if (partName === "label" || partName === "optionLabel") return "label" as const; if (input.has(partName)) return "input" as const; if (button.has(partName)) return "button" as const; if (partName === "listbox") return "listbox" as const; if (partName === "option" || partName === "swatch") return "option" as const; if (["popup","calendar","clock"].includes(partName)) return "dialog" as const; if (partName === "grid") return "grid" as const; if (partName === "gridcell") return "gridcell" as const; if (["errors","inlineError","loading","empty"].includes(partName)) return "status" as const; return "group" as const;
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
    { parents: { label: "inputWrapper", indicator: "inputWrapper" }, classes: { inputWrapper: ["mdy-checkbox"], control: ["mdy-checkbox__control"], indicator: ["mdy-checkbox__indicator"], label: [MDY_FIELD_SHELL_CLASSES.label], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } }),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "inputWrapper", "control", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper" }, classes: { inputWrapper: ["mdy-toggle"], control: ["mdy-toggle__control"], track: ["mdy-toggle__track"], thumb: ["mdy-toggle__thumb"], label: ["mdy-toggle__label"], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } }),
  radio: define("radio", ["mdy-renderer", "mdy-renderer--radio-group"], ["root", "label", "requiredMarker", "group", "option", "optionControl", "optionLabel", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-radio-group"], option: ["mdy-radio-item"], optionControl: ["mdy-radio-circle"], optionLabel: ["mdy-radio-label"] } }),
  segmented: define("segmented", ["mdy-renderer", "mdy-renderer--segmented"], ["root", "label", "requiredMarker", "group", "option", "optionCheck", "optionText", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-segmented"], option: ["mdy-segmented__button"], optionCheck: ["mdy-segmented__check"], optionText: ["mdy-segmented__text"] } }),
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "placeholder", "arrow", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { trigger: ["mdy-select__trigger"], value: ["mdy-select__value"], placeholder: ["mdy-select__placeholder"], arrow: ["mdy-select__arrow"], popup: ["mdy-select__dropdown", MDY_POPUP_CLASS], search: ["mdy-select__search"], listbox: ["mdy-select__list"], option: ["mdy-select__option"], loading: ["mdy-select__loader"], empty: ["mdy-select__empty"] } }),
  // The option chips use the chip vocabulary the Angular renderer established — `mdy-chip` with a
  // check, a label and, in counter mode, the two step buttons and a count. That vocabulary is the
  // contract, which is what makes an option look the same whichever renderer drew it.
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "chips", "chip", "placeholder", "searchButton", "popup", "search", "listbox", "option", "optionCheck", "optionLabel", "optionCount", "optionStep", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { trigger: ["mdy-multiselect"], placeholder: ["mdy-multiselect__placeholder"], chips: ["mdy-multiselect__chips"], chip: ["mdy-chip", "mdy-chip--value"], searchButton: ["mdy-multiselect__search-btn"], popup: ["mdy-multiselect__dropdown", MDY_POPUP_CLASS, "mdy-multiselect-overlay__panel"], search: ["mdy-multiselect-overlay__input"], listbox: ["mdy-multiselect__options"], option: ["mdy-chip"], optionCheck: ["mdy-chip__check"], optionLabel: ["mdy-chip__label"], optionCount: ["mdy-chip__count"], optionStep: ["mdy-chip__btn"], loading: ["mdy-select__loader"], empty: ["mdy-multiselect-overlay__empty"] } }),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { control: ["mdy-datepicker__input"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] } }),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { startControl: ["mdy-datepicker__input", "mdy-daterange__input"], endControl: ["mdy-datepicker__input", "mdy-daterange__input"], separator: ["mdy-daterange__sep"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, "mdy-datepicker__popup--range"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] } }),
  // The clock is the picker, and its anatomy is named here down to the hand and the numbers on the
  // face: a renderer that drew its own dial would be a different widget wearing the same classes,
  // and the foundation places a number from the `--index` it is given, not from where a renderer
  // decided to put it.
  timepicker: define("timepicker", ["mdy-renderer", "mdy-renderer--timepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "container", "content", "header", "hour", "minute", "period", "clock", "dialFace", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { header: "content", clock: "content", dialFace: "clock", dialHand: "dialFace", dialNumber: "dialFace", content: "container", actions: "container", modeToggle: "actions", action: "actions" },
      classes: { control: ["mdy-timepicker__input"], toggle: ["mdy-timepicker__toggle"], popup: ["mdy-timepicker__popup", MDY_POPUP_CLASS], container: ["mdy-timepicker-container"], content: ["mdy-timepicker-content"], header: ["mdy-timepicker-header"], hour: ["mdy-timepicker-segment", "mdy-timepicker-segment--hour"], minute: ["mdy-timepicker-segment", "mdy-timepicker-segment--minute"], period: ["mdy-timepicker-period-toggle"], clock: ["mdy-timepicker-dial"], dialFace: ["mdy-timepicker-dial__face"], dialHand: ["mdy-timepicker-dial__hand"], dialNumber: ["mdy-timepicker-dial__number"], modeToggle: ["mdy-timepicker-mode-toggle"], actions: ["mdy-timepicker-actions"], action: ["mdy-timepicker-action-btn"] } }),
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "fileList", "fileItem", "clear", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { dropzone: ["mdy-file-container"], control: ["mdy-file-input"], content: ["mdy-file-content"], fileList: ["mdy-file-list"], fileItem: ["mdy-file-item"], clear: ["mdy-file-clear"] } }),
  colors: define("colors", ["mdy-renderer", "mdy-renderer--colors"], ["root", "label", "requiredMarker", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle", "popup", "presets", "swatch", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { control: "nativePicker" }, classes: { nativePicker: ["mdy-colors__primary-picker"], preview: ["mdy-colors__preview-swatch"], control: ["mdy-colors__native-hidden"], hexInput: ["mdy-colors__hex-input"], toggle: ["mdy-colors__toggle-area"], popup: ["mdy-colors__dropdown", MDY_POPUP_CLASS], presets: ["mdy-colors__presets"], swatch: ["mdy-color-swatch"] } }),
});

export type MdyWidgetPart<K extends MdyWidgetKind> = keyof (typeof MDY_WIDGET_CONTRACTS)[K]["parts"] & string;
export const MDY_CANONICAL_UI_CLASSES = Object.freeze([...new Set(MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].rootClasses))].sort());
