/**
 * How a widget definition is built, and the tables it is built from.
 *
 * The registry next door is data; this is the machinery that produces it — the part builder, where a
 * part sits by default, which parts are required, which repeat, which shell class stands in, what
 * role a part takes, what states it may carry, which kinds open a popup and how each anchors.
 *
 * Four tables and a builder, in the file the registry used to share with them. A consumer that wants
 * one class name paid for all of it.
 */
import type { MdyPartContract } from "../contract.js";
import type { MdyStateName } from "../state.js";
import {
  dynamicPartsOf, MDY_FIELD_SHELL_CLASSES, MDY_PART_PRESENCE, MDY_PART_REQUIRES, MDY_SHELL_PART_STATES,
} from "../structure.js";
import type { MdyWidgetSemanticElement } from "../structure.js";
import type { MdyValueSlot, MdyWidgetDefinition, MdyWidgetKind, MdyWidgetVariant } from "./kinds.js";
import { semanticElement } from "./semantics.js";

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
 * The popup's *appearance*, carried separately from the popup itself.
 *
 * {@link MDY_POPUP_CLASS} says where a popup is and that it is out of flow. This says what it looks
 * like — a surface, an edge, a radius, an elevation, the room its content sits in — and the two are
 * separate because they are separate questions with different owners.
 *
 * They were one class, and a container that paints is a wrapper around the thing it was supposed to
 * present: a material applied to the content then sits on an opaque panel rather than on the page,
 * which is a translucent effect with nothing to be translucent against. A theme dressing the popup
 * had no way to decline the surface without also fighting the positioning that shares its selector.
 *
 * Every popup carries it, so nothing changes by not asking. A theme that wants the content to
 * present itself neutralises this one class and leaves the coordinates alone.
 */
export const MDY_POPUP_SURFACE_CLASS = "mdy-popup--surface";

/**
 * Where each part hangs. Candidates are tried in order and the first one the widget actually
 * declares wins, so the same table serves a control with an input wrapper and one without.
 * The anatomy is nested rather than flat because containment is part of what an adapter must
 * reproduce: a control outside its wrapper is a different control.
 */
export const PARENT_CANDIDATES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  requiredMarker: ["label"], inlineError: ["label"],
  prefix: ["inputWrapper"], suffix: ["inputWrapper"],
  control: ["dropzone", "inputWrapper", "track"], startControl: ["inputWrapper"], endControl: ["inputWrapper"], separator: ["inputWrapper"],
  decrement: ["inputWrapper"], increment: ["inputWrapper"], trigger: ["inputWrapper"], toggle: ["inputWrapper"],
  // The arrow may be drawn inside a button trigger or beside an input one; what the contract
  // requires is that it lives in the wrapper, and containment is transitive.
  arrow: ["inputWrapper", "trigger"], value: ["trigger", "inputWrapper"], placeholder: ["trigger", "inputWrapper"],
  track: ["inputWrapper"], thumb: ["track"], box: ["inputWrapper"], chips: ["trigger"], chip: ["chips"], chipRemove: ["chip"], chipMove: ["chip"], announcement: ["box", "inputWrapper"],
  group: [], option: ["optionWrapper", "options", "group"], optionControl: ["option"], optionLabel: ["option"], optionCheck: ["option"], optionText: ["option"], optionCount: ["option"], optionStep: ["option"],
  search: ["popup"], optionWrapper: ["options"], options: ["popup", "root"],
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
  // The two views that replace the day grid rather than sitting beside it: a calendar showing its
  // months is not also showing its days, which is why they share the calendar as their parent and
  // never appear at once.
  monthPicker: ["calendar", "popup"], monthCell: ["monthPicker"],
  yearPicker: ["calendar", "popup"], yearCell: ["yearPicker"],
  hour: ["header", "popup"], minute: ["header", "popup"], period: ["header", "popup"],
  preview: ["nativePicker", "inputWrapper"], nativePicker: ["inputWrapper"], hexInput: ["inputWrapper", "popup"], presets: ["popup"], swatch: ["presets"],
  // Resolved against what the kind declares: a timepicker's content frames its dial inside the
  // popup, a file field's frames its dropzone.
  content: ["container", "popup", "dropzone"], fileList: ["dropzone"], fileItem: ["fileList"],
  // Clearing empties the whole field rather than one row, so the button sits beside the list, not
  // inside an item. Containment is transitive, so a renderer may nest it further.
  clear: ["dropzone"],
  // What was refused belongs beside what was kept, not inside the list of it: the list holds the
  // field's value, and a refused file is precisely what did not become part of that value.
  rejected: ["dropzone"],
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
  "monthCell", "yearCell",
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
export const SHELL_CLASS_FALLBACK: Readonly<Record<string, readonly string[]>> = Object.freeze({
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
interface MdyWidgetShape<TPart extends string = string> {
  /** The native control this kind is rendered with — see {@link MdyWidgetDefinition.controlType}. */
  readonly controlType?: string;
  /** Whether the control conceals what is typed into it — see {@link MdyWidgetDefinition.concealed}. */
  readonly concealed?: boolean;
  readonly parents?: Readonly<Partial<Record<TPart, TPart>>>;
  readonly classes?: Readonly<Partial<Record<TPart, readonly string[]>>>;
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
  readonly elements?: Readonly<Partial<Record<TPart, MdyWidgetSemanticElement>>>;
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
  readonly presentation?: Readonly<Record<string, string>>;
  /**
   * Anatomy that depends on how the kind is configured, keyed by the value that decides it.
   *
   * One kind whose parts genuinely differ between configurations, rather than two kinds or a part
   * left unconstrained because no single answer fits. `multiselect` is the case: a toggle option
   * *is* the control and a counter option *contains* two, so naming one element for both would be
   * naming the wrong one half the time — and naming neither is what left the kind uncheckable.
   *
   * The key is the value the public config already carries, never a vocabulary invented here. A
   * variant that has to teach a consumer a new word is a variant that belongs in the config first.
   *
   * What a variant may say is deliberately small: which elements its parts are, what they announce
   * as, and which of them it requires. Anything wider — different parents, different relations —
   * would be a second catalogue rather than a qualification of this one.
   *
   * `roles` is here for the same reason `elements` is, and arrived when a counter chip needed to be
   * a `spinbutton` while a toggle chip stays a `group`: both statements answer *what this part is*,
   * and both genuinely differ between two modes of one widget. Declaring the stronger role for both
   * would promise a value to spin on a chip that holds membership.
   */
  readonly variants?: Readonly<Partial<Record<MdyWidgetVariant, {
    readonly elements?: Readonly<Partial<Record<TPart, MdyWidgetSemanticElement>>>;
    readonly roles?: Readonly<Partial<Record<TPart, string>>>;
    readonly required?: readonly TPart[];
  }>>>;
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
   *
   * A part that only exists inside an overlay is required **of an open widget**: a closed picker
   * renders no popup, so nothing inside one can be demanded at rest. `overlayOnlyParts` decides
   * which those are, so naming one here is a statement about what an open popup must frame.
   */
  readonly required?: readonly TPart[];
}

/**
 * States every field-like widget's shell parts share.
 *
 * Declared in `structure.ts` beside the shell's classes, because the two answer one question — what
 * a shell part is called and what it may be doing — and `MDY_FIELD_STATE_CLASSES` is derived from
 * both. Kept re-bound here under its old name so the catalogue reads as it always has.
 */
export const SHARED_STATES = MDY_SHELL_PART_STATES;

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
export const POPUP_PLACEMENT_STATES: readonly MdyStateName[] = Object.freeze(["above", "overlay", "right"]);

/**
 * Everything a day in a calendar can be at once.
 *
 * A single cell is routinely several of these together — today, selected, and the start of a range —
 * which is why they are states rather than variants: they compose, and a theme paints each one
 * without knowing which others are on. Shared by the datepicker and the range picker, because a day
 * does not mean something different depending on how many dates the field collects.
 */
export const CALENDAR_CELL_STATES: readonly MdyStateName[] = Object.freeze([
  "selected", "today", "outside", "disabled", "focused", "inRange", "rangeStart", "rangeEnd",
]);

/**
 * A month or a year in the views that replace the day grid.
 *
 * One state, because one is what a theme paints. Nothing here is "today" or "outside" — a month
 * picker shows exactly one year's twelve — and a period the bounds refuse carries the native
 * `disabled`, which every theme already styles through `:disabled`. A class declared and painted
 * nowhere is a promise to a theme author that nothing keeps.
 */
export const CALENDAR_PERIOD_CELL_STATES: readonly MdyStateName[] = Object.freeze(["selected"]);

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
  /**
   * A second part a pointer opens the same overlay from, where the kind has one.
   *
   * The calendar button beside a typeable date, the clock beside a typed time, the box a
   * multiselect's chips sit in, the swatch beside a colour. All three renderers answer a press on
   * these and none was asked to: the door worked everywhere, nothing declared it, and a renderer
   * could have lost it with every suite green.
   *
   * It carries no relation. `aria-expanded` and `aria-controls` belong to the part that *holds the
   * value* — one control says whether the overlay is showing, and a second element claiming it
   * announces two comboboxes for one list. This says a pointer may open from here, which is what a
   * check needs to press and what a renderer needs to know it owes. ADR 0177.
   */
  readonly alsoOpensFrom?: string;
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
  /**
   * What the opener promises will appear, as `aria-haspopup` states it.
   *
   * A screen reader announces this with the control — "combobox, has popup listbox" — so a person
   * decides whether to open the thing from what they were told it is. The words are not
   * interchangeable: `listbox` means options with a selected state and a listbox's keyboard, `grid`
   * means a table walked with the arrow keys, `dialog` means somewhere to go and come back from. A
   * promise the popup does not keep is worse than none, because it is acted on.
   *
   * Declared here because the promise and the thing promised must have one source. Written as a
   * literal at each opener it was written five times across two renderers, and two of them said
   * different words for the same widget.
   *
   * Each value is read off the anatomy the same catalogue declares: the kind whose popup frames a
   * part with `role=listbox` promises `listbox`, the ones framing a `grid` promise `grid`, and a
   * popup holding a composite — a search field beside a chooser, a clock face — is a `dialog`.
   */
  readonly promises?: "listbox" | "grid" | "dialog" | "menu" | "tree";
  /**
   * The shape of the kind this relation belongs to, where the kind has more than one.
   *
   * A select drawn as the platform's own chooser opens nothing this contract can see: a `<select>`
   * carrying `aria-expanded`, `aria-controls` or `aria-haspopup` is claiming to be a combobox, which
   * is a lie about what it is and what a reader will find. The relation is the combobox's.
   *
   * Absent means the relation holds for every shape the kind has, which is every other kind here.
   * ADR 0176 records the decision and named this as the half nothing enforced; this is the
   * declaration a checker reads to enforce it.
   */
  readonly variant?: MdyWidgetVariant;
}

export const MDY_POPUP_OPENERS: Readonly<Partial<Record<MdyWidgetKind, MdyPopupOpener>>> = Object.freeze({
  // `controls` is the part the relation names, and it is not always the popup: ARIA points at the
  // element carrying the role — a listbox, a grid, a dialog — which for some kinds sits inside the
  // popup rather than being it.
  select: Object.freeze({ opener: "trigger", controls: "options", role: "combobox", promises: "listbox", variant: "custom" }),
  // A combobox like its single-choice sibling: the opener holds the field's value, so it is what
  // carries `aria-invalid` and `aria-required`, and neither belongs on a role that has no value to
  // be wrong about. Declared nowhere, the states were being written onto a bare `<button>`, where
  // they say nothing an assistive technology may read.
  // Promises a dialog rather than a listbox. The popup frames a search field beside a grid of
  // chips, and this catalogue declares that grid as a `group` — so `listbox` was a promise of
  // options with a selected state and a listbox's keyboard, over a composite that has neither.
  // The whole control opens the popup, as the single-choice sibling's `trigger` does. A magnifier
  // beside the field made the opener a decoration rather than the control, so the role that says
  // "this is what holds the value" sat on a button holding none of it.
  multiselect: Object.freeze({ opener: "trigger", controls: "popup", role: "combobox", promises: "dialog", alsoOpensFrom: "box" }),
  // The pickers follow the combobox pattern: the typeable control is what carries `role=combobox`,
  // `aria-expanded` and `aria-controls`, and the calendar/clock button beside it is a second
  // affordance for the same popup. The opener is therefore the control, not the button — naming the
  // button here would ask for the relation in a place the pattern does not put it.
  datepicker: Object.freeze({ opener: "control", controls: "grid", role: "combobox", typeable: true, promises: "grid", alsoOpensFrom: "toggle" }),
  // Daterange wires its own toggle rather than following the combobox pattern its sibling does.
  daterange: Object.freeze({ opener: "toggle", controls: "popup", promises: "grid" }),
  timepicker: Object.freeze({ opener: "control", controls: "popup", role: "combobox", typeable: true, promises: "dialog", alsoOpensFrom: "toggle" }),
  // The filled square is the opener. It is the most recognisable shape on the field — every platform
  // ships one and everybody has pressed one — and what it does is therefore the field's answer to
  // "how do I choose a colour". A caret beside it that opened the same panel was a second command
  // for one act: two names, two keyboard stops, two things to describe. The caret keeps taking a
  // press, because the area is inside the field and a dead patch in a live control reads as a fault,
  // but it is a drawing rather than a control of its own.
  colors: Object.freeze({ opener: "nativePicker", controls: "popup", promises: "listbox", alsoOpensFrom: "toggle" }),
});

/** Anchoring per kind; widgets with no overlay have none. */
// Every trigger in this catalog sits at the end of its control, so every popup hangs from that end.
// A list that matches its control's width covers both edges and looks the same either way; a
// content-sized popup does not, which is why declaring it is what stops the same calendar opening
// from the left corner on one form and the right corner on another.
/**
 * The kinds whose popup content scrolls. Everything else with an overlay is shown whole or centred.
 *
 * Listed as the exception rather than declared per kind because that is what it is: two of the six
 * overlay kinds hold a list, and the other four hold a fixed layout.
 */
const SCROLLING_OVERLAYS: readonly MdyWidgetKind[] = Object.freeze(["select", "multiselect"]);


const VALUE_SLOTS: Readonly<Record<MdyWidgetKind, MdyValueSlot>> = Object.freeze({
  text: "container", email: "container", password: "container", textarea: "container",
  // The number reads by looking at it; the steppers beside it are frame.
  number: "container",
  // The thumb's position *is* the number, and a track is not a surface holding one.
  slider: "shape",
  // A tick and a switch have two states and their shape tells them apart.
  checkbox: "shape", toggle: "shape",
  // The words beside a dot are the option's label, not the value: the value is *which* is lit.
  radio: "shape", segmented: "shape",
  select: "container",
  // Chips are how the content is written, not another nature of control — a word can be deleted out
  // of a text box too, and that does not make a text box a shape.
  multiselect: "container",
  datepicker: "container", daterange: "container", timepicker: "container",
  // The list is the slot, and a list is looked into. That the files arrive through another window is
  // a fact about entry, exactly as a calendar is for a date.
  file: "container",
  // A filled square is not a switch: a switch has two states its shape distinguishes, and a tint has
  // sixteen million that it does not. The colour is held inside a surface. Where a field is
  // configured with presets and no hex box, that square is the only place the value shows.
  colors: "container",
});

const ANCHORING: Readonly<Partial<Record<MdyWidgetKind, { matchAnchorWidth: boolean; minSpace: number; minWidth?: number; alignment?: "left" | "right" }>>> = Object.freeze({
  select: { matchAnchorWidth: true, minSpace: 180, minWidth: 160, alignment: "right" },
  multiselect: { matchAnchorWidth: true, minSpace: 180, minWidth: 160, alignment: "right" },
  datepicker: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  daterange: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  timepicker: { matchAnchorWidth: false, minSpace: 240, alignment: "right" },
  colors: { matchAnchorWidth: false, minSpace: 120, minWidth: 280, alignment: "right" },
});

/**
 * `NoInfer` on the shape, and it is load-bearing rather than tidy.
 *
 * The part names come from `partNames` and nowhere else. Without this the shape is a second
 * inference site, so a part named only there — a typo, a rename half-applied — widens `TPart` to
 * include it and compiles. The declaration would then be checked against itself: exactly the class
 * of stale key this catalogue has already shipped twice.
 */
export function define<const TPart extends string>(kind: MdyWidgetKind, rootClasses: readonly string[], partNames: readonly TPart[], overlay: boolean, shape: MdyWidgetShape<NoInfer<TPart>> = {}): MdyWidgetDefinition<TPart> {
  const partMap = Object.fromEntries(partNames.map((name) => [
    name,
    // A widget's own states replace the shell's rather than adding to them, so a part that means
    // something different here — a multiselect's `inputWrapper`, which is the chip grid — is not
    // silently given states it cannot be in.
    part(name === "root" ? rootClasses : shape.classes?.[name] ?? SHELL_CLASS_FALLBACK[name] ?? [], {}, statesFor(name, shape), roleFor(kind, name, shape)),
  ])) as Record<TPart, MdyPartContract>;
  const variants = Object.freeze(Object.fromEntries(
    Object.entries(shape.variants ?? {}).map(([name, variant]) => [name, Object.freeze({
      elements: Object.freeze({ ...(variant.elements ?? {}) }),
      roles: Object.freeze({ ...(variant.roles ?? {}) }),
      required: Object.freeze([...(variant.required ?? [])]),
    })]),
  ));
  const declared = new Set<string>(partNames);
  const siblingCount = new Map<string, number>();
  // Built in two passes. Containment is what says a part lives inside the overlay, and containment
  // is only readable once every node has its parent — so the shape is laid out first, and the
  // presence conditions are attached to it after.
  const laidOut = partNames.map((name) => {
    if (name === "root") return { part: name, element: shape.elements?.[name] ?? semanticElement(name), order: 0, optional: false };
    const override = shape.parents?.[name];
    const parent = (override && declared.has(override) ? override : undefined)
      ?? (PARENT_CANDIDATES[name] ?? []).find((candidate) => declared.has(candidate)) ?? "root";
    const order = siblingCount.get(parent) ?? 0;
    siblingCount.set(parent, order + 1);
    return {
      part: name, element: shape.elements?.[name] ?? semanticElement(name), parent: parent as TPart,
      order, optional: !(REQUIRED_PARTS.has(name) || shape.required?.includes(name)),
      repeated: REPEATED_PARTS.has(name),
    };
  });
  // A part inside the popup is present when the popup is, and the anatomy already answers which
  // those are — the same derivation the server split reads. Declared in the table instead it would
  // be a second answer to a settled question, going stale the first time a kind grows a part inside
  // its overlay. The table still wins where it names one, so a part with a sharper condition than
  // "the overlay is open" keeps it.
  const insideAPopup = new Set(dynamicPartsOf(laidOut));
  const nodes = laidOut.map((node) => {
    const presentWhen = node.optional
      ? MDY_PART_PRESENCE[node.part] ?? (insideAPopup.has(node.part) ? "overlayIsOpen" as const : undefined)
      : undefined;
    // What the kind has to have been *given* before the presence question applies. Read without it,
    // this contract owed a reorder grip to every multiselect holding a value; every renderer drew it
    // only where a document asked for reordering, which is a rule none of them could point at.
    // Keyed by `kind.part` where a gate belongs to one kind, by the bare name where it belongs to the
    // part wherever it appears. A slider's `value` is not a select's: the bare key gave a slider's
    // required readout a capability sliders do not have, which is a table telling the truth about one
    // kind and a lie about another.
    const requires = MDY_PART_REQUIRES[`${kind}.${node.part}`] ?? MDY_PART_REQUIRES[node.part];
    if (presentWhen === undefined && requires === undefined) return node;
    return Object.freeze({
      ...node,
      ...(presentWhen === undefined ? {} : { presentWhen }),
      ...(requires === undefined ? {} : { requires }),
    });
  });
  return Object.freeze({ kind, rootClasses: Object.freeze([...rootClasses]),
    ...(shape.controlType === undefined ? {} : { controlType: shape.controlType }),
    ...(shape.concealed === undefined ? {} : { concealed: shape.concealed }),
    parts: Object.freeze(partMap), structure: Object.freeze({ kind, nodes: Object.freeze(nodes) }), presentationClasses: Object.freeze({ ...(shape.presentation ?? {}) }), variants, valueSlot: VALUE_SLOTS[kind], capabilities: Object.freeze({ overlay, dismissOnOutsidePointer: overlay ? "light-dismiss" as const : false, dismissOnFocusOutside: overlay, overlayScrolls: SCROLLING_OVERLAYS.includes(kind), ...(overlay && ANCHORING[kind] ? { anchoring: Object.freeze(ANCHORING[kind]) } : {}) }) });
}
/**
 * The semantic every part answers to, declared rather than defaulted.
 *
 * A name missing from here throws rather than falling back to `group`: the contract does not get to
 * have no opinion by accident. A default would let an unclassified part silently admit any element
 * at all, and the absence of an answer is indistinguishable from a deliberate one.
 *
 * `group` still appears, and means a container the contract does not constrain further — an answer,
 * not the absence of one.
 */
