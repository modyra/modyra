import { deepFreeze } from "./freeze.js";
import { MDY_STATE_MODIFIERS, stateClass, type MdyStateName } from "./state.js";

/**
 * Version of the framework-agnostic UI contract implemented by this package.
 *
 * It names the **anatomy**, not the shape of the declaration: an adapter reads it to say *"the parts
 * I build are the parts this number describes"*, and the audits that check a renderer against the
 * catalogue refuse a version they were not written for. So it moves whenever a part a renderer was
 * told to build stops existing, changes its element, or gains a role — the changes
 * `contract:diff --since <tag>` classifies major.
 *
 * It stayed at 1 across a release that removed `datepicker.actions` and `daterange.actions` and
 * turned `multiselect.searchButton` from a `button` into an `input` with `role="combobox"`. Two
 * renderers written against "contract version 1" would then have implemented two different
 * anatomies, and the number that exists to prevent exactly that said they were the same.
 *
 * 3 names an anatomy where `multiselect.popup` carries `role="dialog"`. A renderer built against 2
 * emits that panel with no role, which is a conforming renderer under 2 and a non-conforming one
 * here — the case this number exists to make visible rather than to let pass.
 *
 * 4 moved a boolean's indicator and a toggle's track under the label. 5 gives a timepicker's dial
 * two more parts — the layer of stretches that carry no selectable time, and each stretch in it —
 * which sit between the face and the hand, so a renderer built against 4 draws them nowhere.
 */
export const MDY_WIDGET_CONTRACT_VERSION = 5 as const;

/** Semantic element categories that presenters can map to their native rendering API. */
export type MdyWidgetSemanticElement =
  | "root" | "label" | "input" | "button" | "group" | "status" | "submission"
  | "listbox" | "option" | "radio" | "dialog" | "grid" | "gridcell" | "container"
  | "presentation" | "popup" | "text" | "affordance" | "columnheader" | "image";

/**
 * The conditions under which an optional part is on the page.
 *
 * Closed, and each entry is a question a renderer can already answer without asking the contract
 * anything further. Free text would be unreadable to a check, and a check is the whole point: an
 * unwritten condition is what let the same optional part appear under three different rules.
 */
export const MDY_PART_PRESENCES = Object.freeze([
  /** The document supplied the content — a label, help text, an affix. */
  "documentDeclaresIt",
  /** The field is required. */
  "fieldIsRequired",
  /**
   * The field has constraints, so it can fail one.
   *
   * The error container is reserved at rest under exactly these fields, and stays reserved after a
   * correction. A container that appears with the first message moves everything below it at the
   * moment a person is reaching for the next field — which is the field that moves. Reserved, that
   * jump is gone; and taking the reservation back when the message clears is the same jump upward.
   *
   * Read from the field, never from its kind: an optional note with a length limit has a constraint,
   * and a checkbox that must be ticked has one.
   */
  "fieldCanBeInvalid",
  /** There are errors to show, by the rules that decide when an error is shown. */
  "errorsAreVisible",
  /** The widget's overlay is open. */
  "overlayIsOpen",
  /** The field holds a value. */
  "valueIsPresent",
  /**
   * The field holds no value.
   *
   * The other half of the same question, and it needs saying: a placeholder is not present because a
   * document supplied the words for it — that is necessary and not enough. It is present because the
   * words were supplied *and* there is nothing yet to show instead.
   */
  "valueIsAbsent",
  /** The kind's own configuration turns this part on. */
  "kindOffersIt",
  /** The view this part belongs to is the one showing. */
  "viewIsActive",
  /**
   * More values are chosen than the control can show at once.
   *
   * Distinct from holding a value: the count that says "and four more" is meaningless while all of
   * them fit, and it is not a property of how many there are but of how many are on screen.
   */
  "valuesOverflow",
  /** A destructive action can still be taken back. */
  "undoIsOnOffer",
  /**
   * Something offered to the field was rejected before it could become a value.
   *
   * Not an error about the value — there is no value. A file of the wrong type never entered, and
   * saying so is a different message in a different place from a rule the value broke.
   */
  "inputWasRefused",
  /** The pointer is resting on one of the chosen values. */
  "pointerIsOnAValue",
  /** The field is waiting on something and says so. */
  "workIsInFlight",
] as const);

/**
 * Derived from the list above rather than written twice.
 *
 * A union restated beside the array it mirrors is a second declaration, and a check reading the
 * restatement passes while the array grows past it — which is how a vocabulary comes to have two
 * lengths. A test can only read the array, so the array is what everything reads.
 */
export type MdyPartPresence = (typeof MDY_PART_PRESENCES)[number];

/**
 * Who decides each presence condition, and where a consumer goes to ask.
 *
 * A condition with no way to decide it is a declaration each renderer interprets for itself, which is
 * how one of these came to mean one thing where chips are drawn and another where they are not. The
 * three the package answers today carry 85 of the 185 declarations, and that is the direction of the
 * causation rather than a coincidence: a condition a consumer can ask about is the one consumers read.
 *
 * Three will never have a resolver, and saying so here is the point of the table. A condition whose
 * answer restates an input the renderer already holds cannot be got wrong by anybody, and a function
 * over it would put a call between a consumer and a fact in their hand. Left as a blank they read as
 * gaps, and the next person counting resolvers reports three findings that are decisions.
 *
 * `owed` is the third state, and there is nothing in it today. It is kept in the shape because a
 * condition added to the contract arrives owed, and the table has to be able to say so rather than
 * force whoever adds it to invent an answer on the spot. ADR 0169.
 */
/**
 * Which message names a part that no relation points at.
 *
 * Most parts are named by being pointed at: a caption's `for`, an opener's `aria-controls`. Five are
 * not, and they are not machinery — a person types in a panel's search box, in the second date of a
 * range, in each half of a time. Nothing declared what those are called, so each renderer chose, and
 * they chose differently: one built `"<caption> — end"` by hand where another read `daterangeEndLabel`
 * from the message table, and a page in Italian said "end".
 *
 * The words already existed in the table for every one of them. What was missing was the sentence
 * saying which word belongs to which part — so this is a binding rather than a vocabulary, and the
 * translation of a control's name stops being a decision a renderer takes on its own.
 *
 * Keyed `kind.part`. A part named by a relation is not here and must not be: two ways to name one
 * element is the divergence this removes.
 */
export const MDY_PART_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "select.search": "searchOptionsLabel",
  "multiselect.search": "searchOptionsLabel",
  // The first of the two is named by the caption's `for` — a range's caption belongs to where the
  // range starts — so only the second is unclaimed. Binding both would be two ways to name one
  // element, which is what this table removes.
  "daterange.endControl": "daterangeEndLabel",
  "timepicker.hourControl": "timepickerHourLabel",
  "timepicker.minuteControl": "timepickerMinuteLabel",
});

export const MDY_PRESENCE_RESOLUTION: Readonly<Record<MdyPartPresence, {
  /** The published name that answers it, or `null` where nothing does. */
  readonly resolver: string | null;
  /** Why nothing answers it — `"owed"`, or the reason no answer is possible or needed. */
  readonly because: string;
}>> = Object.freeze({
  overlayIsOpen: { resolver: "overlayOnlyParts", because: "answered" },
  errorsAreVisible: { resolver: "errorsVisible", because: "answered" },
  fieldCanBeInvalid: { resolver: "fieldCanBeInvalid", because: "answered" },
  // Decides it, and was not named as deciding it — which is worse than a gap: a consumer looking for
  // the resolver finds none and writes a second one beside the function that already answers.
  valuesOverflow: { resolver: "hiddenChipCount", because: "answered" },

  undoIsOnOffer: { resolver: "undoIsOnOffer", because: "answered" },
  valueIsPresent: { resolver: "valueIsPresent", because: "answered" },
  valueIsAbsent: { resolver: "valueIsAbsent", because: "answered" },
  fieldIsRequired: { resolver: "fieldIsRequired", because: "answered" },
  viewIsActive: { resolver: "viewIsActive", because: "answered" },
  inputWasRefused: { resolver: "inputWasRefused", because: "answered" },
  workIsInFlight: { resolver: "workIsInFlight", because: "answered" },

  documentDeclaresIt: {
    resolver: null,
    because: "the renderer was handed the label, the text, the prefix — a resolver would return "
      + "`input !== undefined` and put a call between a consumer and a fact in their hand",
  },
  kindOffersIt: {
    resolver: null,
    because: "the catalogue a renderer already reads to know the part exists is the answer; a "
      + "resolver would restate `MDY_WIDGET_CONTRACTS[kind].parts`",
  },
  pointerIsOnAValue: {
    resolver: null,
    because: "only the renderer knows where a pointer is, and the contract should say so rather "
      + "than promise an answer no controller can give",
  },
});

/**
 * When each optional part is on the page, by part name.
 *
 * Keyed by name because the anatomy is declared twice — derived per kind, and written out once for
 * the shell every field shares — and a table is the only shape in which the two cannot disagree. A part
 * called
 * `supportingText` is the same part wherever it appears, and a table is the only shape in which
 * seventeen kinds cannot disagree about it.
 *
 * A name missing from here is a part whose condition has not been decided. That is a gap, and the
 * audit records it — but a *wrong* entry is worse than a missing one, because it tells a renderer to
 * build something at a moment when it is not wanted and nothing notices until it is on the page.
 */
export const MDY_PART_PRESENCE: Readonly<Record<string, MdyPartPresence>> = Object.freeze({
  label: "documentDeclaresIt",
  supportingText: "documentDeclaresIt",
  prefix: "documentDeclaresIt",
  suffix: "documentDeclaresIt",
  requiredMarker: "fieldIsRequired",
  // Shown in place of a value, so the document supplying the words is only half of it.
  placeholder: "valueIsAbsent",
  // A value drawn as a chip, and everything a chip carries: they exist per chosen value — the strip
  // and its row included. Read once as containers built with the control and kept, which the page
  // contradicts: with nothing chosen there is no strip, not an empty one.
  chips: "valueIsPresent",
  chipRow: "valueIsPresent",
  chip: "valueIsPresent",
  chipRemove: "valueIsPresent",
  chipMove: "valueIsPresent",
  // One entry per chosen file. The list that holds them is built once and is not this.
  fileItem: "valueIsPresent",
  // What a chosen value is shown as, where the control is not a text box.
  value: "valueIsPresent",
  // Taking the value away is offered once there is one to take.
  clearAll: "valueIsPresent",
  clear: "valueIsPresent",
  // Drawn because the kind has them, not because of anything the field is doing: a chooser's arrow,
  // a multiselect's own layout box, a number's steppers, the list a file field puts its entries in.
  // The condition is not vacuous — it says a renderer that draws this kind another way is still
  // conformant, which is what `optional` alone left each of them to decide privately.
  arrow: "kindOffersIt",
  box: "kindOffersIt",
  increment: "kindOffersIt",
  decrement: "kindOffersIt",
  fileList: "kindOffersIt",
  // The hidden companion a native submit reads when the box is unticked. Carries no class of its
  // own, which is why a sweep by class reports it absent: it is there, and it is there because this
  // shape participates in native submission at all.
  submitFalse: "kindOffersIt",
  // The form's own refusals — a failed call, a service that is down — which name no field. A form
  // can always be refused, so the container is part of the shape rather than of any state; only its
  // contents follow the refusals.
  formErrors: "kindOffersIt",
  formErrorItem: "errorsAreVisible",
  // A calendar shows one view at a time. `overlayIsOpen` is true of all six of these at once, which
  // the page contradicts: with the day view up, the month and year pickers are hidden and their cells
  // are not built. The condition is the sharper one, and it implies the popup is open — a view cannot
  // be the one showing inside a panel that is not there.
  grid: "viewIsActive",
  weekdays: "viewIsActive",
  weekday: "viewIsActive",
  row: "viewIsActive",
  gridcell: "viewIsActive",
  monthPicker: "viewIsActive",
  monthCell: "viewIsActive",
  yearPicker: "viewIsActive",
  yearCell: "viewIsActive",
  overflowCount: "valuesOverflow",
  wayBackAction: "undoIsOnOffer",
  rejected: "inputWasRefused",
  chipTooltip: "pointerIsOnAValue",
  loading: "workIsInFlight",
  // Reserved at rest under every field that can fail a constraint, and still reserved after a
  // correction: taking the space back when the message clears is the same jump as giving it, upward.
  errors: "fieldCanBeInvalid",
  errorItem: "errorsAreVisible",
  inlineError: "errorsAreVisible",
  popup: "overlayIsOpen",
});

/** One node in a widget's framework-independent structural anatomy. */
export interface MdyWidgetStructureNode<TPart extends string = string> {
  readonly part: TPart;
  readonly element: MdyWidgetSemanticElement;
  readonly parent?: TPart;
  readonly order: number;
  /**
   * Whether a renderer may leave this part out **while its parent is on the page**.
   *
   * Required is a statement about the part's place, not about the whole widget's lifetime: six kinds
   * declare a required part inside an optional `popup` — `select.listbox`, `datepicker.calendar`,
   * `colors.presets` and their siblings — and read as "always present" that is a contradiction with
   * `overlayOnlyParts`, which names those same parts as ones a closed widget has no reason to build.
   *
   * Both are true under this reading and neither is under the other: a closed select need not build
   * its listbox because the popup that would hold it is absent, and a select whose popup *is* on the
   * page must have one. So a renderer that builds an overlay's contents only when it opens is
   * conformant, and so is one that builds them eagerly — the difference between them is a rendering
   * choice, which is what `overlayOnlyParts` exists to say — in its own words, *"a closed widget is
   * not required to render any of them … what both must do is render them when open"*. This is the
   * same sentence from the part's side, where a reader deciding what to build actually looks.
   */
  readonly optional?: boolean;
  /**
   * What has to be true for an optional part to be on the page.
   *
   * `optional` says a renderer *may* leave a part out and stops there, so three renderers decided
   * three times when to build it and conformance had nothing to ask. A part that is present under a
   * condition nobody wrote is a part each adapter invents a rule for.
   *
   * Named `presentWhen` rather than `when` because `when` already means the overlay phase on a key
   * binding, and one word carrying two meanings is how a declaration comes to be read two ways.
   */
  readonly presentWhen?: MdyPartPresence;
  readonly repeated?: boolean;
}

/** Ordered structural anatomy for a widget. This is metadata, not a virtual DOM. */
export interface MdyWidgetStructure<TPart extends string = string> {
  readonly kind: string;
  readonly nodes: readonly MdyWidgetStructureNode<TPart>[];
}

/** Canonical shell parts shared by field-like controls. */
export type MdyFieldShellPart =
  | "root" | "label" | "requiredMarker" | "inputWrapper" | "prefix"
  | "control" | "suffix" | "inlineError" | "supportingText"
  | "errors" | "errorItem";

/** Canonical class vocabulary. Presenters must not invent adapter-specific equivalents. */
export const MDY_FIELD_SHELL_CLASSES = Object.freeze({
  root: "mdy-renderer",
  label: "mdy-label",
  requiredMarker: "mdy-label__required",
  inputWrapper: "mdy-input-wrapper",
  prefix: "mdy-input-prefix",
  control: "mdy-input-wrapper__inliner",
  suffix: "mdy-input-suffix",
  inlineError: "mdy-control__inline-errors",
  supportingText: "mdy-supporting-text",
  errors: "mdy-control__errors",
  errorItem: "mdy-control__error",
} satisfies Record<MdyFieldShellPart, string>);

/**
 * States every field-like widget's shell parts share.
 *
 * The shell is the same shell whatever it wraps, so its states are declared once rather than
 * seventeen times: a wrapper is disabled or in error, a label is filled or has an error to make room
 * for, a root is open or has been touched.
 *
 * Beside the shell's classes rather than in the catalogue, because a shell part's name and the
 * states it may be in are one fact, and {@link MDY_FIELD_STATE_CLASSES} is derived from both.
 */
export const MDY_SHELL_PART_STATES: Readonly<Record<string, readonly MdyStateName[]>> =
  Object.freeze({
    root: ["open", "touched"],
    // `readonly` beside `disabled` because they are different refusals a person has to be able to
    // tell apart: a disabled field is out of play, a read-only one is in play and locked. Declared
    // and unpainted, a form locked for review looked exactly like one waiting to be filled in.
    inputWrapper: ["disabled", "error", "readonly"],
    // `unwritten` marks a label the shell had to compose because no document wrote one: everything
    // inside a field is named by pointing at the label, so an empty one leaves a group, a grid or a
    // dialog announced as its role and nothing else. The words are `fieldAccessibleName`'s, and the
    // class is what lets a theme keep them out of sight — a name is owed to a screen reader, a
    // heading is not.
    label: ["filled", "hasError", "unwritten"],
    requiredMarker: ["filled"],
  });

/**
 * State classes every field carries, independent of kind.
 *
 * **Derived**, not restated. Every member here already existed as one of `MDY_FIELD_SHELL_CLASSES`,
 * `MDY_SHELL_PART_STATES` or `MDY_STATE_MODIFIERS`, written out a second time and in a second
 * vocabulary: `labelStates` said `"has-error"`, the modifier, where the shell states say
 * `"hasError"`, the state. Two tables for one fact drift the moment one of them is edited, and they
 * drift silently — a theme rule keyed to the spelling nobody updated simply stops matching.
 *
 * The names are measured, not invented. An earlier set — `mdy-field--invalid`, `mdy-control--open`
 * and the rest — was styled by **no theme** and emitted by **no renderer**: a renderer built from
 * the contract alone would have produced classes nothing painted, which is the one failure mode this
 * vocabulary exists to prevent. What is really on screen is a modifier on the renderer root, one on
 * the wrapper holding the control, and one on the label.
 *
 * `fieldStates` and `controlStates` are read twice over by their consumers — once as a key into the
 * field's state, once as the modifier suffix — so they are the state *names*, which for these is
 * also how they are spelled as classes.
 */
const shellStates = (part: string): readonly string[] =>
  (MDY_SHELL_PART_STATES[part] ?? []).map((state) => MDY_STATE_MODIFIERS[state]);

export const MDY_FIELD_STATE_CLASSES = Object.freeze({
  /** Base the field root's state modifiers hang from. */
  field: MDY_FIELD_SHELL_CLASSES.root,
  /** States the field root reflects. */
  fieldStates: Object.freeze(shellStates("root")),
  /** Base the wrapper holding the control, which is where a field shows it is unusable or wrong. */
  control: MDY_FIELD_SHELL_CLASSES.inputWrapper,
  /** States that wrapper reflects. */
  controlStates: Object.freeze(shellStates("inputWrapper")),
  /** Base the label's own modifiers hang from. */
  label: MDY_FIELD_SHELL_CLASSES.label,
  /** States the label reflects: whether the field has a value, and whether it is failing. */
  labelStates: Object.freeze(shellStates("label")),
  /** The root modifier an overlay widget carries while its popup is showing. */
  rendererOpen: stateClass(MDY_FIELD_SHELL_CLASSES.root, "open"),
});

/**
 * Classes that belong to no single widget: the shared button, the overlay machinery, the surface
 * treatments a theme applies wherever it likes.
 *
 * Contract data, published through `@modyra/widgets/vocabulary`. They are not a kind's anatomy and
 * belong to no catalogue entry, which is why they are declared here rather than in one — but a theme
 * selects on them, so they are names this package promises to keep.
 *
 * Seven of the eight are already selected on by the themes shipped in this repository, so the
 * promise is not hypothetical. It was, however, unguarded: `contract:diff` reaches class names
 * through a kind's parts, so a name outside every kind was invisible to it and a rename would have
 * been reported as an internal change while breaking every stylesheet that used one. The snapshot
 * now records them alongside the scale, for the same reason and in the same shape.
 */
export const MDY_SHARED_UI_CLASSES = Object.freeze([
  "mdy-button",
  // What the inline error draws inside itself. The part is one element on thirteen kinds; its icon
  // and its tooltip are the same two classes wherever it appears.
  "mdy-control__inline-errors-icon",
  "mdy-control__inline-errors-tooltip",
  // Set on the field root when it shows its errors inline instead of as a list. A choice about the
  // whole field rather than one kind's anatomy, and the themes key off it.
  "mdy-inline-errors",
  "mdy-overlay",
  "mdy-overlay-panel",
  // The scrim behind a modal overlay. One backdrop per panel rather than one per widget, which is
  // why it belongs to the overlay machinery and to no kind's anatomy.
  "mdy-overlay-backdrop",
  "mdy-glass-effect",
  "mdy-glass-effect--medium",
]);

/**
 * Attaches each optional node's presence condition from the one table.
 *
 * Derived rather than written beside each node: this anatomy is declared twice — here, and again per
 * kind where the catalogue builds it — and a condition copied into both is a condition that drifts
 * the first time one of them is edited.
 */
function withPresence<TPart extends string>(
  nodes: readonly MdyWidgetStructureNode<TPart>[],
): readonly MdyWidgetStructureNode<TPart>[] {
  return Object.freeze(nodes.map((node) => {
    const presentWhen = node.optional === true ? MDY_PART_PRESENCE[node.part] : undefined;
    return Object.freeze(presentWhen === undefined ? node : { ...node, presentWhen });
  }));
}

/** Base field anatomy. Widget-specific contracts extend this ordered tree. */
export const MDY_FIELD_SHELL_STRUCTURE = deepFreeze({
  kind: "field-shell",
  nodes: withPresence([
    { part: "root", element: "root", order: 0 },
    { part: "label", element: "label", parent: "root", order: 0, optional: true },
    { part: "requiredMarker", element: "text", parent: "label", order: 0, optional: true },
    { part: "inputWrapper", element: "group", parent: "root", order: 1 },
    { part: "prefix", element: "presentation", parent: "inputWrapper", order: 0, optional: true },
    { part: "control", element: "input", parent: "inputWrapper", order: 1 },
    { part: "suffix", element: "presentation", parent: "inputWrapper", order: 2, optional: true },
    { part: "inlineError", element: "image", parent: "label", order: 1, optional: true },
    { part: "supportingText", element: "text", parent: "root", order: 2, optional: true },
    { part: "errors", element: "status", parent: "root", order: 3, optional: true },
    { part: "errorItem", element: "text", parent: "errors", order: 0, optional: true, repeated: true },
  ]),
} satisfies MdyWidgetStructure<MdyFieldShellPart>);

/**
 * Canonical parts of the form itself, as against a field's shell.
 *
 * Not every refusal belongs to a field. A failed network call, a service that is down, a cross-field
 * rule only a server can check: they arrive with no path, the engine keeps them in
 * `state.lastSubmitErrors()`, and until this part existed there was nowhere in any renderer's markup
 * to put them — so a person pressed Send while the server said no and saw their fields exactly as
 * they had left them.
 *
 * The region is a `status`, not a field's error list: it speaks for the form, it appears after an
 * action the person took, and it is announced when it arrives rather than when it is reached.
 */
export type MdyFormShellPart = "formErrors" | "formErrorItem";

/** Canonical class vocabulary for the form's own parts. */
export const MDY_FORM_SHELL_CLASSES = Object.freeze({
  formErrors: "mdy-form__errors",
  formErrorItem: "mdy-form__error",
} satisfies Record<MdyFormShellPart, string>);

/**
 * Where the form's own refusals sit: first, before the fields.
 *
 * A summary a person has to scroll past their whole form to find is a summary they do not read, and
 * a refusal about the submission as a whole belongs where the submission was answered.
 */
/*
 * Annotated rather than inferred. The two nodes have different shapes — one names a parent, the
 * other does not — so an inferred type is a union of two object literals with optional members, and
 * the two TypeScript implementations write that union's members in different orders. The published
 * type is what this file already means: a structure of this part vocabulary.
 */
export const MDY_FORM_SHELL_STRUCTURE: MdyWidgetStructure<MdyFormShellPart> = Object.freeze({
  kind: "form-shell",
  // Through the same table as every other anatomy: this shell is small enough to have been written
  // out by hand twice over, which is exactly how two declarations of one rule start.
  nodes: withPresence<MdyFormShellPart>([
    { part: "formErrors", element: "status", order: 0, optional: true },
    { part: "formErrorItem", element: "text", parent: "formErrors", order: 0, optional: true, repeated: true },
  ]),
});

// `MdyPartMap` lives with `MdyPartContract`, in `contract.ts`. It was the only thing this module took
// from there, and taking it closed a cycle between the package's two hubs — neither of which could
// then be read, or extracted, on its own. A map of a thing belongs beside the thing.

/** Every part reachable from `roots` by following `parent`, the roots included. */
function subtree(nodes: readonly MdyWidgetStructureNode[], roots: readonly string[]): ReadonlySet<string> {
  const inside = new Set(roots);
  // The anatomy is a flat list of parent references, so containment is transitive and a single
  // pass is not enough: a gridcell's parent is a grid whose parent is the popup. Iterating to a
  // fixed point costs nothing at this size and does not depend on the list being ordered.
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of nodes) {
      if (node.parent !== undefined && inside.has(node.parent) && !inside.has(node.part)) {
        inside.add(node.part);
        changed = true;
      }
    }
  }
  return inside;
}

/**
 * The same derivation over a bare node list, so it can be exercised on anatomies the catalogue does
 * not contain — in particular ones whose nodes are not listed parent-before-child.
 *
 * The catalogue's are, today, which is exactly why this exists: a derivation that only works on
 * sorted input would pass every test in this repository and put a part that lives inside a popup
 * into the half a server is told to emit.
 */
export function dynamicPartsOf(nodes: readonly MdyWidgetStructureNode[]): readonly string[] {
  const popups = nodes.filter((node) => node.element === "popup").map((node) => node.part);
  if (popups.length === 0) return [];
  const inside = subtree(nodes, popups);
  return nodes.map((node) => node.part).filter((part) => inside.has(part));
}

/**
 * Which shell classes a field's state puts on, derived from the table that declares them.
 *
 * `MDY_FIELD_STATE_CLASSES` has always said which base each shell part carries and which states it
 * admits. What it never said is the answer — *given these flags, which classes are on* — so every
 * renderer wrote that out, and wrote the class names as string literals beside lines that read the
 * vocabulary properly. One of them spells the same state raw in one place and derives it in another.
 *
 * One state, two spellings, which is the part a renderer gets wrong: a failing field takes `--error`
 * on its wrapper and `--has-error` on its label. Both were declared and nothing composed them.
 *
 * **Every class is named, on or off.** A list of only the ones that are on tells a renderer what to
 * add and not what to take away, so a field that stops failing keeps the class that says it is —
 * which is the shape of a control stuck looking wrong after it was corrected. Returned per part
 * because they land on three elements, and a flat list makes the caller work out which is which.
 */
export function shellStateClasses(state: {
  readonly open?: boolean;
  readonly touched?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  /** Failing: `--error` on the wrapper, `--has-error` on the label. One state, two names. */
  readonly error?: boolean;
  readonly filled?: boolean;
  /** The label stands in for a name the document never wrote. */
  readonly unwritten?: boolean;
}): {
  readonly field: Readonly<Record<string, boolean>>;
  readonly control: Readonly<Record<string, boolean>>;
  readonly label: Readonly<Record<string, boolean>>;
} {
  const shell = MDY_FIELD_STATE_CLASSES;
  const on = (base: string, pairs: readonly (readonly [string, boolean | undefined])[]) =>
    Object.freeze(Object.fromEntries(pairs.map(([suffix, flag]) => [`${base}--${suffix}`, flag === true])));
  return Object.freeze({
    field: on(shell.field, [["open", state.open], ["touched", state.touched]]),
    control: on(shell.control, [["disabled", state.disabled], ["error", state.error], ["readonly", state.readonly]]),
    label: on(shell.label, [["filled", state.filled], ["has-error", state.error], ["unwritten", state.unwritten]]),
  });
}
