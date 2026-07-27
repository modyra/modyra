import type { MdyPartContract } from "./contract.js";
import type { MdyWidgetStructure } from "./structure.js";

export const MDY_WIDGET_KINDS = ["text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle", "radio", "segmented", "select", "multiselect", "datepicker", "daterange", "timepicker", "file", "colors"] as const;
export type MdyWidgetKind = (typeof MDY_WIDGET_KINDS)[number];

export interface MdyWidgetDefinition<TPart extends string = string> {
  readonly kind: MdyWidgetKind;
  readonly rootClasses: readonly string[];
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
  readonly structure: MdyWidgetStructure<TPart | "root">;
  readonly capabilities: { readonly keyboard: boolean; readonly focus: boolean; readonly overlay: boolean; };
}

function part(classes: readonly string[] = [], attributes: MdyPartContract["attributes"] = {}): MdyPartContract { return Object.freeze({ classes: Object.freeze([...classes]), attributes: Object.freeze({ ...attributes }) }); }
function define<const TPart extends string>(kind: MdyWidgetKind, rootClasses: readonly string[], partNames: readonly TPart[], overlay: boolean): MdyWidgetDefinition<TPart> {
  const partMap = Object.fromEntries(partNames.map((name) => [name, part(name === "root" ? rootClasses : [], {})])) as Record<TPart, MdyPartContract>;
  const nodes = partNames.map((name, order) => Object.freeze({ part: name, element: semanticElement(name), ...(name === "root" ? {} : { parent: "root" as TPart }), order, optional: name !== "root" }));
  return Object.freeze({ kind, rootClasses: Object.freeze([...rootClasses]), parts: Object.freeze(partMap), structure: Object.freeze({ kind, nodes: Object.freeze(nodes) }), capabilities: Object.freeze({ keyboard: true, focus: true, overlay }) });
}
function semanticElement(partName: string) {
  const input = new Set(["control","startControl","endControl","search","hour","minute","hexInput","nativePicker"]);
  const button = new Set(["toggle","decrement","increment","searchButton","clear"]);
  if (partName === "root") return "root" as const; if (partName === "label" || partName === "optionLabel") return "label" as const; if (input.has(partName)) return "input" as const; if (button.has(partName)) return "button" as const; if (partName === "listbox") return "listbox" as const; if (partName === "option" || partName === "swatch") return "option" as const; if (["popup","calendar","clock"].includes(partName)) return "dialog" as const; if (partName === "grid") return "grid" as const; if (partName === "gridcell") return "gridcell" as const; if (["errors","inlineError","loading","empty"].includes(partName)) return "status" as const; return "group" as const;
}

export const MDY_WIDGET_CONTRACTS = Object.freeze({
  text: define("text", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  email: define("email", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  password: define("password", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  textarea: define("textarea", ["mdy-renderer", "mdy-renderer--textarea"], ["root", "label", "requiredMarker", "inputWrapper", "control", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  number: define("number", ["mdy-renderer", "mdy-renderer--number"], ["root", "label", "requiredMarker", "inputWrapper", "control", "decrement", "increment", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  slider: define("slider", ["mdy-renderer", "mdy-renderer--slider"], ["root", "label", "requiredMarker", "track", "control", "value", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  checkbox: define("checkbox", ["mdy-renderer", "mdy-renderer--checkbox"], ["root", "control", "label", "requiredMarker", "supportingText", "errors", "errorItem"] as const, false),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "control", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  radio: define("radio", ["mdy-renderer", "mdy-renderer--radio-group"], ["root", "label", "requiredMarker", "group", "option", "optionControl", "optionLabel", "supportingText", "errors", "errorItem"] as const, false),
  segmented: define("segmented", ["mdy-renderer", "mdy-renderer--segmented"], ["root", "label", "requiredMarker", "group", "option", "optionCheck", "optionText", "supportingText", "errors", "errorItem"] as const, false),
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "arrow", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "trigger", "chips", "chip", "searchButton", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "calendar", "grid", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
  timepicker: define("timepicker", ["mdy-renderer", "mdy-renderer--timepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "header", "hour", "minute", "period", "clock", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "fileList", "fileItem", "clear", "supportingText", "errors", "errorItem"] as const, false),
  colors: define("colors", ["mdy-renderer", "mdy-renderer--colors"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "preview", "nativePicker", "hexInput", "presets", "swatch", "inlineError", "supportingText", "errors", "errorItem"] as const, true),
});

export type MdyWidgetPart<K extends MdyWidgetKind> = keyof (typeof MDY_WIDGET_CONTRACTS)[K]["parts"] & string;
export const MDY_CANONICAL_UI_CLASSES = Object.freeze([...new Set(MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].rootClasses))].sort());
