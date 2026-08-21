/**
 * Which element a part is, when the contract does not say otherwise.
 *
 * A table from part name to semantic element: `control` is an input, `popup` is a dialog, a
 * `gridcell` is a cell. Read by the conformance harness as much as by a renderer, which is why it
 * is data rather than a switch inside the builder.
 */
import type { MdyWidgetSemanticElement } from "../structure.js";

const PART_SEMANTICS: Readonly<Record<string, MdyWidgetSemanticElement>> = Object.freeze({
  root: "root", label: "label",
  // Controls and the things that operate them.
  control: "input", startControl: "input", endControl: "input", search: "input",
  // A timepicker's `hour` and `minute` are the segments the header lays out — containers. The
  // element a user types into is the control inside each, named separately so the contract reaches
  // it: a segment holding a `<div>` where the input belongs is a widget nothing can operate.
  hour: "group", minute: "group", hourControl: "input", minuteControl: "input",
  hexInput: "input", nativePicker: "input",
  // The trigger is the widget's control surface, not a plain button: it carries `role="combobox"`,
  // and a native `<select>` satisfies it too.
  trigger: "input",
  toggle: "button", clear: "button",
  // The multiselect's opener, and the same thing `trigger` is for its single-choice sibling: it
  // holds the field's value, so it carries `role="combobox"`, `aria-expanded`, `aria-invalid` and
  // `aria-required`. Declared a plain button, none of those had anywhere legitimate to sit.
  searchButton: "input",
  modeToggle: "button", action: "button", optionStep: "button", chip: "button",
  // Announcements.
  errors: "status", loading: "status", empty: "status", errorItem: "status",
  // A file the field turned away is not an error of the value — the field holds what it accepted and
  // is valid — but it is an answer to something the person just did, so it announces itself.
  rejected: "status",
  // An icon carrying its message as a label, not a live region: the message itself already reaches
  // assistive technology through the control's `aria-describedby`, and announcing it twice is worse
  // than announcing it once.
  inlineError: "image",
  // Supporting text describes the control; it is not an announcement, and it carries no live role.
  supportingText: "text",
  // Text the user reads.
  value: "text", placeholder: "text", optionLabel: "text", optionText: "text", optionCount: "text",
  separator: "text", requiredMarker: "text",
  weekday: "columnheader",
  // Decoration: it carries meaning for the eye, and none for assistive technology.
  arrow: "presentation", indicator: "presentation", thumb: "presentation", preview: "presentation",
  optionCheck: "presentation", optionControl: "presentation", dialHand: "presentation",
  // Drawn surfaces with nothing to operate: the layer of dimmed stretches and each stretch in it.
  dialUnavailable: "presentation", dialUnavailableArc: "presentation",
  dialFace: "presentation",
  // The numbers are painted on the face; the face takes the pointer, so they announce nothing.
  dialNumber: "presentation",
  // Structures with their own semantics.
  listbox: "listbox", option: "option", swatch: "option", popup: "popup", calendar: "popup",
  clock: "popup", dialog: "dialog", grid: "grid", gridcell: "gridcell",
  // The month and year views are grids of choices, like the day grid they replace — so a keyboard
  // user meets the same structure whichever view is showing, rather than a run of bare buttons.
  monthPicker: "grid", monthCell: "gridcell", yearPicker: "grid", yearCell: "gridcell",
  // Containers the contract deliberately leaves unconstrained.
  group: "group", inputWrapper: "group", prefix: "group", suffix: "group", container: "group",
  content: "group", header: "group", dialogHeader: "group", actions: "group", chips: "group",
  options: "group", optionWrapper: "group", dropzone: "group", fileList: "group",
  // A palette you pick one colour from. All three renderers say `role="listbox"` over
  // `role="option"` swatches, which is what it is; calling it an unconstrained group let the
  // contract have no opinion about a widget every renderer had already agreed on.
  presets: "listbox",
  fileItem: "group", weekdays: "group", row: "group", track: "group", period: "group",
});

export function semanticElement(partName: string): MdyWidgetSemanticElement {
  const semantic = PART_SEMANTICS[partName];
  if (!semantic) {
    throw new RangeError(
      `[modyra] Part "${partName}" has no declared semantic. Add it to PART_SEMANTICS — a part the ` +
      `contract has no opinion about admits every element, which is not a contract.`,
    );
  }
  return semantic;
}

/**
 * Variation the contract permits, and why.
 *
 * Measured across all three renderers in the resting state. Each of these is a part left `optional`
 * on purpose; without the reason written down, "optional" is indistinguishable from "nobody asked".
 *
 * - `select.value` and `multiselect.placeholder` are an either/or: a renderer shows the chosen value
 *   or, when there is none, the placeholder. Both parts exist; only one is on screen at a time.
 * - `supportingText` may be replaced by the error list rather than shown beside it. Renderers differ,
 *   and both are defensible — which is why a projection is told whether the description was rendered
 *   rather than assuming it.
 * - `file.clear` and `file.fileList` are a feature choice: a file field may offer to clear its
 *   selection and to list what was chosen, and one that does neither is still a file field.
 * - `file.rejected` is on screen only when the field has just turned a candidate away, which is a
 *   state and not a feature: a field that has refused nothing shows nothing there.
 *
 * One measured difference is *not* covered here and is not a rendering question: the numeric kinds
 * start at `0` in one renderer and `null` in another, so `required` passes on one and fails on the
 * other. That is a value-semantics disagreement and belongs with the value dimension, not the DOM.
 */
