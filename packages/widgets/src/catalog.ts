import { MDY_CHIP_CLASSES } from "./chip.js";
import type { MdyPartContract } from "./contract.js";
import type { MdyStateName } from "./state.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_SHELL_PART_STATES } from "./structure.js";
import type { MdyWidgetSemanticElement, MdyWidgetStructure } from "./structure.js";

export const MDY_WIDGET_KINDS = ["text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle", "radio", "segmented", "select", "multiselect", "datepicker", "daterange", "timepicker", "file", "colors"] as const;
export type MdyWidgetKind = (typeof MDY_WIDGET_KINDS)[number];

export interface MdyWidgetDefinition<TPart extends string = string> {
  readonly kind: MdyWidgetKind;
  readonly rootClasses: readonly string[];
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
  readonly structure: MdyWidgetStructure<TPart | "root">;
  /** Classes this kind's renderers may carry that are not parts. See `MdyWidgetShape.presentation`. */
  readonly presentationClasses: readonly string[];
  readonly capabilities: {
    /**
     * Whether this kind owns an overlay.
     *
     * The only one of these that ever varied. `keyboard` and `focus` were declared beside it and
     * were `true` on all seventeen kinds — every widget here is operable from the keyboard and can
     * hold focus, so as *per-kind flags* they said nothing, and a consumer branching on one was
     * branching on a constant. They are gone rather than left as decoration: a declared capability
     * that cannot be false is a promise with no content.
     */
    readonly overlay: boolean;
    /**
     * A pointer outside the overlay dismisses it.
     *
     * Exactly `overlay` on every kind today, and kept because it is the one of the four that can
     * meaningfully be false: a popup a click elsewhere cannot dismiss is a real design, and this is
     * where it would be declared.
     *
     * It names the **event**, because leaving that open let three adapters each pick one and the
     * choice is observable: `pointerdown` fires on press, `click` only on a completed press-and-
     * release over the same target. A drag beginning outside an open popup — the gesture a touch
     * user makes to scroll — fires the first and never the second, so the same gesture dismissed on
     * two renderers and not on the third.
     *
     * `"click"` is the answer: a drag that begins outside is not necessarily a dismissal, and a user
     * may press, think better of it, and return. Dismissing on the press takes the popup away from
     * someone who had not decided to close it.
     *
     * The shape can express either answer rather than recording the one chosen — a capability that
     * can only say what is currently true is the kind this catalogue has already had to withdraw.
     */
    readonly dismissOnOutsidePointer: false | { readonly event: "pointerdown" | "click" };
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
 * that a panel positioned by its host, in its own coordinate space, must not have.
 */
export const MDY_OVERLAY_PORTAL_CLASS = "mdy-overlay";

function part(classes: readonly string[] = [], attributes: MdyPartContract["attributes"] = {}, states: readonly MdyStateName[] = [], role?: string): MdyPartContract {
  return Object.freeze({ classes: Object.freeze([...classes]), attributes: Object.freeze({ ...attributes }), ...(states.length ? { states: Object.freeze([...states]) } : {}), ...(role ? { role } : {}) });
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
  // The arrow may be drawn inside a button trigger or beside an input one; what the contract
  // requires is that it lives in the wrapper, and containment is transitive.
  arrow: ["inputWrapper", "trigger"], value: ["trigger", "inputWrapper"], placeholder: ["trigger", "inputWrapper"],
  track: ["inputWrapper"], thumb: ["track"], chips: ["trigger"], chip: ["chips"], searchButton: ["trigger"],
  group: [], option: ["optionWrapper", "listbox", "options", "group"], optionControl: ["option"], optionLabel: ["option"], optionCheck: ["option"], optionText: ["option"], optionCount: ["option"], optionStep: ["option"],
  search: ["popup"], listbox: ["popup"], optionWrapper: ["options", "listbox"], options: ["root"],
  // A field that is loading has to say so without being opened, so the indicator belongs to the
  // control. `empty` is the opposite case: "no options match" is a statement about the list, and it
  // has nothing to say until there is a list on screen.
  loading: ["inputWrapper", "popup"], empty: ["popup"],
  // A container and its content are the popup's own frame. Without them here they fell through to
  // `root`, which said the whole dial was a resting-state part and made a closed picker look like a
  // renderer that had lost thirteen of them.
  container: ["popup"],
  // Same reasoning as `grid` below: the header belongs to the calendar where a renderer draws one
  // and to the popup where it does not. What the contract requires is that it is inside the overlay.
  dialogHeader: ["calendar", "popup"], header: ["content", "popup"], calendar: ["popup"], clock: ["content", "popup"], actions: ["container", "popup"],
  grid: ["calendar", "popup"], weekdays: ["grid"], weekday: ["weekdays"], row: ["grid"], gridcell: ["row", "grid"],
  hour: ["header", "popup"], minute: ["header", "popup"], period: ["header", "popup"],
  preview: ["nativePicker", "inputWrapper"], nativePicker: ["inputWrapper"], hexInput: ["inputWrapper", "popup"], presets: ["popup"], swatch: ["presets"],
  // Resolved against what the kind declares: a timepicker's content frames its dial inside the
  // popup, a file field's frames its dropzone.
  content: ["container", "popup", "dropzone"], fileList: ["dropzone"], fileItem: ["fileList"],
  // Clearing empties the whole field rather than one row, so the button sits beside the list, not
  // inside an item. Containment is transitive, so a renderer may nest it further.
  clear: ["dropzone"],
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
  /**
   * The ARIA role a part must carry, where the contract requires one.
   *
   * Distinct from `element`, which says what a part may *be*: `SEMANTIC_ELEMENTS` lists the roles a
   * semantic admits, and this names the one it has to have. Without it the contract could say a part
   * may be a listbox and never say that it is one.
   */
  readonly roles?: Readonly<Record<string, string>>;
  /** States this widget's parts may be in, over and above {@link SHARED_STATES}. */
  readonly states?: Readonly<Record<string, readonly MdyStateName[]>>;
  /**
   * Semantic element overrides. A boolean control wraps its text in the `<label>` itself, so the
   * `label` *part* there is the text inside it — declaring it a `<label>` would ask a renderer for
   * a label inside a label, which is not valid HTML and not what any of them emit.
   */
  readonly elements?: Readonly<Record<string, MdyWidgetSemanticElement>>;
  /**
   * Classes a renderer of this kind may carry that are not parts.
   *
   * Structure the themes style and the contract does not otherwise constrain: a spacer, a header
   * label, a variant marker. They are declared because a theme has to be able to enumerate what it
   * may target and a renderer has to know what it may emit — and deliberately not as parts. A part
   * has anatomy: an element, a parent, an order, a place in every relation and state check.
   * Claiming that for a visual container would freeze the DOM well past what has to be shared,
   * which is the one thing this contract sets out not to do.
   */
  readonly presentation?: readonly string[];
  /**
   * Parts this kind must render at rest, over and above the ones every field has.
   *
   * `REQUIRED_PARTS` names the eight parts that are mandatory whatever the widget is — the control
   * and whatever holds it. Everything else was optional by default, which is not the same as a
   * decision that it may be absent: it meant no renderer could be caught omitting a checkbox's
   * indicator or a select's arrow, because the contract had never been asked.
   *
   * What goes here is measured, not assumed: a part all three renderers emit in the resting state.
   * A part some of them omit stays optional, and the reason belongs next to it.
   */
  readonly required?: readonly string[];
}

/**
 * States every field-like widget's shell parts share.
 *
 * Declared in `structure.ts` beside the shell's classes, because the two answer one question — what
 * a shell part is called and what it may be doing — and `MDY_FIELD_STATE_CLASSES` is derived from
 * both. Kept re-bound here under its old name so the catalogue reads as it always has.
 */
const SHARED_STATES = MDY_SHELL_PART_STATES;

/**
 * The role a part must carry: the kind's own declaration, then the shared table, then the role the
 * overlay relation already names for an opener — derived rather than restated, so the two cannot
 * disagree.
 */
function roleFor(kind: MdyWidgetKind, name: string, shape: MdyWidgetShape): string | undefined {
  const own = shape.roles?.[name];
  if (own) return own;
  if (MDY_POPUP_OPENERS[kind]?.opener === name) return MDY_POPUP_OPENERS[kind]?.role;
  return SHARED_ROLES[name];
}

/**
 * Roles that mean the same thing on every kind that has the part.
 *
 * Empty today. The error list looked like the obvious member and is not one: it is a `<ul>`, and
 * `role="alert"` would replace its list semantics rather than add urgency to them. It announces
 * through `aria-live` instead, which is an attribute and not this table's business.
 */
const SHARED_ROLES: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Whether a widget has made a shell part into a part of its own.
 *
 * The test is the class it carries, not the fact that it names one. A kind that restates the shell's
 * own class has changed nothing — `checkbox` declares `label: ["mdy-label"]` so that its label sits
 * inside the wrapper, and that is still `mdy-label`, still the element a floating label rises on.
 * Reading the declaration alone as "different part" took `filled` and `hasError` away from it.
 */
function redeclaresShellPart(name: string, shape: MdyWidgetShape): boolean {
  const declared = shape.classes?.[name];
  if (declared === undefined) return false;
  const shell = SHELL_CLASS_FALLBACK[name];
  if (shell === undefined) return true;
  return declared.length !== shell.length || declared.some((className, i) => className !== shell[i]);
}

/**
 * The states a part ends up with: the widget's own if it declares any, otherwise the shell's — but
 * only where the part really is the shell's.
 *
 * A widget that gives a part a class of its **own** has made it a different part. A multiselect's
 * `inputWrapper` is `mdy-multiselect`, the grid of chips; handing it `mdy-input-wrapper`'s states
 * would mint `mdy-multiselect--disabled`, a class no theme has ever styled and no renderer has ever
 * emitted. The root is the exception, because every root carries `mdy-renderer` whatever else it
 * also carries.
 */
function statesFor(name: string, shape: MdyWidgetShape): readonly MdyStateName[] {
  const own = shape.states?.[name];
  if (own) return own;
  if (name !== "root" && redeclaresShellPart(name, shape)) return [];
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
const POPUP_PLACEMENT_STATES: readonly MdyStateName[] = Object.freeze(["above", "overlay", "right"]);

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
export interface MdyPopupOpener {
  /** The part the user operates to open the overlay, and the one that must carry the relation. */
  readonly opener: string;
  /** The part the relation names — the element carrying the overlay's role. */
  readonly controls: string;
  /**
   * The role the opener takes, where the pattern requires one.
   *
   * A typeable control that also opens a list is a combobox, and `aria-expanded` and
   * `aria-controls` are only allowed on it once it says so. An opener that is already a button
   * needs no role and declares none.
   */
  readonly role?: string;
  /**
   * Whether the opener is a control the user types into.
   *
   * `opener` names the element that carries the overlay relation, and for the combobox kinds that is
   * correctly the typeable control — the pattern puts `aria-expanded` nowhere else. But the same
   * declaration was being read as "the element that toggles the overlay", and those are not the same
   * element's job: a pointer landing in a text field is the user reaching for the caret, not for a
   * switch, and a press of the space bar there is a space character.
   *
   * Saying so once here is what keeps the relation on the element the pattern requires while the
   * behaviour follows what the element actually is.
   */
  readonly typeable?: boolean;
}

export const MDY_POPUP_OPENERS: Readonly<Partial<Record<MdyWidgetKind, MdyPopupOpener>>> = Object.freeze({
  // `controls` is the part the relation names, and it is not always the popup: ARIA points at the
  // element carrying the role — a listbox, a grid, a dialog — which for some kinds sits inside the
  // popup rather than being it.
  select: { opener: "trigger", controls: "listbox", role: "combobox" },
  multiselect: { opener: "searchButton", controls: "popup" },
  // The pickers follow the combobox pattern: the typeable control is what carries `role=combobox`,
  // `aria-expanded` and `aria-controls`, and the calendar/clock button beside it is a second
  // affordance for the same popup. The opener is therefore the control, not the button — naming the
  // button here would ask for the relation in a place the pattern does not put it.
  datepicker: { opener: "control", controls: "grid", role: "combobox", typeable: true },
  // Daterange wires its own toggle rather than following the combobox pattern its sibling does.
  daterange: { opener: "toggle", controls: "popup" },
  timepicker: { opener: "control", controls: "popup", role: "combobox", typeable: true },
  // Colours is the exception: it has no combobox control, so its toggle really is the opener.
  colors: { opener: "toggle", controls: "popup" },
});

/** Anchoring per kind; widgets with no overlay have none. */
// Every trigger in this catalog sits at the end of its control, so every popup hangs from that end.
// A list that matches its control's width covers both edges and looks the same either way; a
// content-sized popup does not, which is why declaring it is what stops the same calendar opening
// from the left corner on one form and the right corner on another.
const ANCHORING: Readonly<Partial<Record<MdyWidgetKind, { matchAnchorWidth: boolean; minSpace: number; minWidth?: number; alignment?: "left" | "right" }>>> = Object.freeze({
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
    part(name === "root" ? rootClasses : shape.classes?.[name] ?? SHELL_CLASS_FALLBACK[name] ?? [], {}, statesFor(name, shape), roleFor(kind, name, shape)),
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
    return Object.freeze({ part: name, element: shape.elements?.[name] ?? semanticElement(name), parent: parent as TPart, order, optional: !(REQUIRED_PARTS.has(name) || shape.required?.includes(name)), repeated: REPEATED_PARTS.has(name) });
  });
  return Object.freeze({ kind, rootClasses: Object.freeze([...rootClasses]), parts: Object.freeze(partMap), structure: Object.freeze({ kind, nodes: Object.freeze(nodes) }), presentationClasses: Object.freeze([...(shape.presentation ?? [])]), capabilities: Object.freeze({ overlay, dismissOnOutsidePointer: overlay ? Object.freeze({ event: "click" as const }) : false, ...(overlay && ANCHORING[kind] ? { anchoring: Object.freeze(ANCHORING[kind]) } : {}) }) });
}
/**
 * The semantic every part answers to, declared rather than defaulted.
 *
 * This used to end in `return "group"`, so a part nobody had classified silently admitted any
 * element at all — 121 of 237 nodes were `group` because the question had never been asked. A name
 * missing from here now throws: the contract does not get to have no opinion by accident.
 *
 * `group` still appears, and means the same as it always did — a container the contract does not
 * constrain further. The difference is that it is now an answer rather than the absence of one.
 */
const PART_SEMANTICS: Readonly<Record<string, MdyWidgetSemanticElement>> = Object.freeze({
  root: "root", label: "label",
  // Controls and the things that operate them.
  control: "input", startControl: "input", endControl: "input", search: "input", hour: "input",
  minute: "input", hexInput: "input", nativePicker: "input",
  // The trigger is the widget's control surface, not a plain button: it carries `role="combobox"`,
  // and a native `<select>` satisfies it too.
  trigger: "input",
  toggle: "button", searchButton: "button", clear: "button",
  modeToggle: "button", action: "button", optionStep: "button", chip: "button",
  // Announcements.
  errors: "status", loading: "status", empty: "status", errorItem: "status",
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
  dialFace: "presentation",
  // The numbers are painted on the face; the face takes the pointer, so they announce nothing.
  dialNumber: "presentation",
  // Structures with their own semantics.
  listbox: "listbox", option: "option", swatch: "option", popup: "popup", calendar: "popup",
  clock: "popup", dialog: "dialog", grid: "grid", gridcell: "gridcell",
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

function semanticElement(partName: string): MdyWidgetSemanticElement {
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
 *
 * One measured difference is *not* covered here and is not a rendering question: the numeric kinds
 * start at `0` in one renderer and `null` in another, so `required` passes on one and fails on the
 * other. That is a value-semantics disagreement and belongs with the value dimension, not the DOM.
 */
export const MDY_WIDGET_CONTRACTS = Object.freeze({
  text: define("text", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  email: define("email", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
  password: define("password", ["mdy-renderer", "mdy-renderer--text"], ["root", "label", "requiredMarker", "inputWrapper", "prefix", "control", "suffix", "inlineError", "supportingText", "errors", "errorItem"] as const, false),
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
    { parents: { label: "inputWrapper", indicator: "inputWrapper" }, elements: { label: "text" }, classes: { inputWrapper: ["mdy-checkbox"], control: ["mdy-checkbox__control"], indicator: ["mdy-checkbox__indicator"], label: [MDY_FIELD_SHELL_CLASSES.label], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
      roles: { control: "checkbox" } ,
      required: ["indicator"] }),
  toggle: define("toggle", ["mdy-renderer", "mdy-renderer--toggle"], ["root", "inputWrapper", "control", "track", "thumb", "label", "requiredMarker", "inlineError", "supportingText", "errors", "errorItem"] as const, false,
    { parents: { label: "inputWrapper" }, elements: { label: "text" }, classes: { inputWrapper: ["mdy-toggle"], control: ["mdy-toggle__control"], track: ["mdy-toggle__track"], thumb: ["mdy-toggle__thumb"], label: ["mdy-toggle__label"], requiredMarker: [MDY_FIELD_SHELL_CLASSES.requiredMarker] } ,
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
  segmented: define("segmented", ["mdy-renderer", "mdy-renderer--segmented"], ["root", "label", "requiredMarker", "group", "option", "optionCheck", "optionText", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { group: ["mdy-segmented"], option: ["mdy-segmented__button"], optionCheck: ["mdy-segmented__check"], optionText: ["mdy-segmented__text"] },
      // Left unconstrained, and that is a finding rather than a preference. A choice may be a
      // <label> around an <input type=radio>, the same native pattern as radio, or a <button>.
      // Both are defensible — a radiogroup, or a toolbar of pressed buttons —
      // but they are not the same control to a screen reader, and the contract cannot require one
      // without breaking the other today. Task 16 (renderer equivalence) decides which; until it
      // does, declaring "either" honestly beats asserting a shape only one adapter meets.
      elements: { option: "presentation" },
      roles: { group: "radiogroup" } ,
      states: { option: ["selected"] } ,
      presentation: ["mdy-segmented__button--first", "mdy-segmented__button--last"] ,
      required: ["option", "optionCheck", "optionText"] }),
  select: define("select", ["mdy-renderer", "mdy-renderer--select"], ["root", "label", "requiredMarker", "inputWrapper", "trigger", "value", "placeholder", "arrow", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { trigger: ["mdy-select__trigger"], value: ["mdy-select__value"], placeholder: ["mdy-select__placeholder"], arrow: ["mdy-select__arrow"], popup: ["mdy-select__dropdown", MDY_POPUP_CLASS], search: ["mdy-select__search"], listbox: ["mdy-select__list"], option: ["mdy-select__option"], loading: ["mdy-select__loader"], empty: ["mdy-select__empty"] },
      // `selected` is the value; `active` is where the keyboard is. They are genuinely different —
      // arrowing through a list moves `active` without changing what is chosen — and a renderer that
      // conflated them would make the list unnavigable for anyone not using a pointer.
      roles: { listbox: "listbox", option: "option" } ,
      states: { arrow: ["open"], trigger: ["open", "disabled", "readonly", "invalid", "loading"], listbox: ["open"], option: ["selected", "active", "hidden"], popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-select", "mdy-select__option-label"] ,
      required: ["arrow", "placeholder"] }),
  // What the control shows for the current selection comes before the affordance that changes it:
  // the chips, or the placeholder standing in for them while nothing is chosen, then the header with
  // its search button. The order used to fall out of the sequence these names were written in, which
  // is not a decision — it put the placeholder after the search affordance, which no renderer does.
  // The option chips use the shared chip vocabulary — `mdy-chip` with a check, a label and, in
  // counter mode, the two step buttons and a count. That vocabulary is the contract, which is what
  // makes an option look the same whichever renderer drew it.
  // The anatomy: the options are chips in a grid *in the field*, and
  // the header's search button opens a popup holding the same grid over a filter box. A trigger
  // showing value chips (`chips`/`chip`/`placeholder`) is the compact alternative, so those parts
  // stay declared and optional. Which classes a chip carries is `multiselectChipClasses`, never a
  // string in a renderer.
  multiselect: define("multiselect", ["mdy-renderer", "mdy-renderer--multiselect"], ["root", "label", "requiredMarker", "inputWrapper", "chips", "chip", "placeholder", "header", "searchButton", "options", "optionWrapper", "option", "optionCheck", "optionStep", "optionLabel", "optionCount", "popup", "search", "listbox", "loading", "empty", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
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
      classes: { inputWrapper: ["mdy-multiselect"], header: ["mdy-multiselect__header"], searchButton: ["mdy-multiselect__search-btn"], options: ["mdy-multiselect__options"], optionWrapper: [MDY_CHIP_CLASSES.wrapper], option: [MDY_CHIP_CLASSES.block], optionCheck: [MDY_CHIP_CLASSES.check], optionLabel: [MDY_CHIP_CLASSES.label], optionCount: [MDY_CHIP_CLASSES.count], optionStep: [MDY_CHIP_CLASSES.step], chips: ["mdy-multiselect__chips"], chip: [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value], placeholder: ["mdy-multiselect__placeholder"], popup: ["mdy-multiselect__dropdown", MDY_POPUP_CLASS, "mdy-multiselect-overlay__panel"], search: ["mdy-multiselect-overlay__input"], listbox: ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"], loading: ["mdy-select__loader"], empty: ["mdy-multiselect-overlay__empty"] } ,
      // The two mode markers a chip carries. `--centered` reserves the width its tick will need in
      // toggle mode; `--counter` is the bag mode, whose chip has step buttons instead of a tick.
      presentation: ["mdy-chip--centered", "mdy-chip--counter"] ,
      // `optionCheck` is toggle mode's: a counter chip has a count between two steppers and no tick
      // to draw, so requiring it would ask every counter-mode renderer for an element that means
      // nothing there.
      required: ["header", "option", "optionLabel", "options", "searchButton"] }),
  datepicker: define("datepicker", ["mdy-renderer", "mdy-renderer--datepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { control: ["mdy-datepicker__input"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] },
      roles: { grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell" } ,
      states: { gridcell: CALENDAR_CELL_STATES, popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-datepicker", "mdy-datepicker__action-btn", "mdy-datepicker__action-btn--primary", "mdy-datepicker__header-label", "mdy-datepicker__header-nav", "mdy-datepicker__icon", "mdy-datepicker__nav-btn", "mdy-datepicker__title", "mdy-datepicker__view-icon", "mdy-datepicker__view-toggle"] ,
      required: ["toggle", "calendar"] }),
  daterange: define("daterange", ["mdy-renderer", "mdy-renderer--datepicker", "mdy-renderer--daterange"], ["root", "label", "requiredMarker", "inputWrapper", "startControl", "separator", "endControl", "toggle", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { classes: { startControl: ["mdy-datepicker__input", "mdy-daterange__input"], endControl: ["mdy-datepicker__input", "mdy-daterange__input"], separator: ["mdy-daterange__sep"], toggle: ["mdy-datepicker__toggle"], popup: ["mdy-datepicker__popup", MDY_POPUP_CLASS, "mdy-datepicker__popup--range"], calendar: ["mdy-datepicker__calendar"], dialogHeader: ["mdy-datepicker__header"], grid: ["mdy-datepicker__grid"], weekdays: ["mdy-datepicker__weekdays"], weekday: ["mdy-datepicker__weekday"], row: ["mdy-datepicker__row"], gridcell: ["mdy-datepicker__cell"], actions: ["mdy-datepicker__actions"] },
      roles: { grid: "grid", row: "row", weekdays: "row", weekday: "columnheader", gridcell: "gridcell" } ,
      states: { gridcell: CALENDAR_CELL_STATES, popup: POPUP_PLACEMENT_STATES } ,
      presentation: ["mdy-datepicker", "mdy-datepicker__action-btn", "mdy-datepicker__action-btn--primary", "mdy-datepicker__header-label", "mdy-datepicker__header-nav", "mdy-datepicker__icon", "mdy-datepicker__nav-btn", "mdy-datepicker__title", "mdy-datepicker__view-icon", "mdy-datepicker__view-toggle", "mdy-daterange__group", "mdy-daterange__hint", "mdy-daterange__input-sizer"] ,
      required: ["separator", "toggle", "calendar"] }),
  // The clock is the picker, and its anatomy is named here down to the hand and the numbers on the
  // face: a renderer that drew its own dial would be a different widget wearing the same classes,
  // and the foundation places a number from the `--index` it is given, not from where a renderer
  // decided to put it.
  timepicker: define("timepicker", ["mdy-renderer", "mdy-renderer--timepicker"], ["root", "label", "requiredMarker", "inputWrapper", "control", "toggle", "popup", "dialog", "container", "content", "header", "hour", "minute", "period", "clock", "dialFace", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "supportingText", "errors", "errorItem"] as const, true,
    { parents: { dialog: "popup", header: "content", clock: "content", dialFace: "clock", dialHand: "dialFace", dialNumber: "dialFace", content: "container", actions: "container", modeToggle: "actions", action: "actions" },
      // `hour` and `minute` share `mdy-timepicker-segment`, so `active` — which of the two the dial
      // is currently editing — hangs off that shared base and is one rule in a theme, not two.
      states: { hour: ["active", "focused"], minute: ["active", "focused"], period: ["compact"], dialNumber: ["selected", "inner"], action: ["confirm"], popup: POPUP_PLACEMENT_STATES },
      // The hour and minute *segments* are the containers the header lays out; each holds its own
      // <input type=number> with an aria-label. Declaring them inputs asked a renderer for a control
      // that is one level down and not a declared part at all — a gap task 08 should close by naming
      // the inner control, not one this batch papers over by widening the check.
      elements: { hour: "group", minute: "group", dialog: "dialog" },
      // The element the popup frames and the relation names: it carries `role="dialog"` and the
      // modal semantics, which the positioning container does not.
      classes: { control: ["mdy-timepicker__input"], toggle: ["mdy-timepicker__toggle"], popup: ["mdy-timepicker__popup", MDY_POPUP_CLASS], dialog: ["mdy-timepicker__dialog"], container: ["mdy-timepicker-container"], content: ["mdy-timepicker-content"], header: ["mdy-timepicker-header"], hour: ["mdy-timepicker-segment", "mdy-timepicker-segment--hour"], minute: ["mdy-timepicker-segment", "mdy-timepicker-segment--minute"], period: ["mdy-timepicker-period-toggle"], clock: ["mdy-timepicker-dial"], dialFace: ["mdy-timepicker-dial__face"], dialHand: ["mdy-timepicker-dial__hand"], dialNumber: ["mdy-timepicker-dial__number"], modeToggle: ["mdy-timepicker-mode-toggle"], actions: ["mdy-timepicker-actions"], action: ["mdy-timepicker-action-btn"] } ,
      presentation: ["mdy-timepicker", "mdy-timepicker--dial", "mdy-timepicker__icon", "mdy-timepicker-dial-variant", "mdy-timepicker-fields", "mdy-timepicker-period-btn", "mdy-timepicker-period-btn--selected", "mdy-timepicker-segment-input", "mdy-timepicker-segment-input--readonly", "mdy-timepicker-separator", "mdy-timepicker-spacer", "mdy-timepicker-segment-label"] ,
      required: ["toggle"] }),
  file: define("file", ["mdy-renderer", "mdy-renderer--file"], ["root", "label", "requiredMarker", "dropzone", "control", "content", "fileList", "fileItem", "clear", "supportingText", "errors", "errorItem"] as const, false,
    { classes: { dropzone: ["mdy-file-container"], control: ["mdy-file-input"], content: ["mdy-file-content"], fileList: ["mdy-file-list"], fileItem: ["mdy-file-item"], clear: ["mdy-file-clear"] },
      states: { dropzone: ["dragover"] } ,
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
      classes: { nativePicker: ["mdy-colors__primary-picker"], preview: ["mdy-colors__preview-swatch"], control: ["mdy-colors__native-hidden"], hexInput: ["mdy-colors__hex-input"], toggle: ["mdy-colors__toggle-area"], popup: ["mdy-colors__dropdown", MDY_POPUP_CLASS], presets: ["mdy-colors__presets"], swatch: ["mdy-color-swatch"] } ,
      presentation: ["mdy-colors", "mdy-colors__dropdown-header", "mdy-select__arrow"] ,
      required: ["hexInput", "nativePicker", "preview", "toggle"] }),
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
