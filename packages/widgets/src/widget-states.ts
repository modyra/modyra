/**
 * The states a widget can be in, as against the modifiers a *part* can carry.
 *
 * `MDY_STATE_MODIFIERS` in `state.ts` is a class vocabulary: what a theme paints on an element.
 * This is the other thing — the condition the whole control is in, which decides what it renders,
 * what it exposes to assistive technology, and what the user can do to it. A suite that only ever
 * inspects the state a fixture happened to mount in checks none of it.
 *
 * Declared from the contract's point of view, deliberately not by reading what any renderer emits:
 * a specification written from the implementation only ever ratifies it.
 */
import { MDY_POPUP_OPENERS, type MdyWidgetKind, type MdyWidgetPart } from "./catalog.js";
import { dynamicParts } from "./ssr.js";

/** Every state any widget may declare. */
export const MDY_WIDGET_STATES = [
  "pristine", "touched", "empty", "filled", "invalid",
  "disabled", "readonly", "open", "focused", "selected", "loading",
] as const;

export type MdyWidgetState = (typeof MDY_WIDGET_STATES)[number];

/**
 * What a state means for the DOM, independent of kind.
 *
 * `nativeAttribute` is the point of the whole exercise. A renderer that flips only `aria-disabled`
 * leaves the native control focusable and editable: assistive technology is told one thing and the
 * keyboard does another. The contract has to separate *the semantic state exposed* from *the
 * behavioural state in effect*, and only a matrix can check that they agree.
 */
export interface MdyWidgetStateContract {
  /** The ARIA attribute that must carry this state, and the value it must carry. */
  readonly aria?: { readonly attribute: string; readonly value: string };
  /** The native attribute that must be applied to the control, not merely mirrored in ARIA. */
  readonly nativeAttribute?: string;
  /** Parts the contract requires to exist in this state. */
  readonly requiresParts?: readonly string[];
  /** Parts that must NOT exist in this state. */
  readonly forbidsParts?: readonly string[];
  /**
   * What the state means for the *form*, as against the DOM.
   *
   * Two states can render almost identically and behave completely differently — `disabled` and
   * `readonly` differ in whether the field is sent and checked at all. A contract describing only
   * attributes cannot express that, because nothing about the markup distinguishes them.
   */
  readonly behaviour?: {
    /** Whether a field in this state is included in what a submit sends. */
    readonly submitted: boolean;
    /** Whether a field in this state is validated. */
    readonly validated: boolean;
    /** Whether the user can still reach the control: focus it, select its text, copy it. */
    readonly reachable: boolean;
  };
}

export const MDY_WIDGET_STATE_CONTRACTS: Readonly<Record<MdyWidgetState, MdyWidgetStateContract>> =
  Object.freeze({
    pristine: {},
    touched: {},
    empty: {},
    filled: {},
    invalid: { aria: { attribute: "aria-invalid", value: "true" }, requiresParts: ["errors"] },
    // A disabled field is a question the form is not asking; a read-only one is a question it has
    // answered on the user's behalf.
    disabled: {
      aria: { attribute: "aria-disabled", value: "true" },
      nativeAttribute: "disabled",
      behaviour: { submitted: false, validated: false, reachable: false },
    },
    readonly: {
      aria: { attribute: "aria-readonly", value: "true" },
      nativeAttribute: "readonly",
      behaviour: { submitted: true, validated: true, reachable: true },
    },
    open: { aria: { attribute: "aria-expanded", value: "true" }, requiresParts: ["popup"] },
    focused: {},
    selected: {},
    loading: { requiresParts: ["loading"] },
  });

/**
 * The parts that must expose each ARIA state, per kind.
 *
 * "Somewhere on the widget" is not where an assistive technology looks. `aria-expanded` belongs on
 * the element a user operates to open the thing; a select that moved it to its root would announce
 * a collapsed combobox while showing an open list, and a check that accepts any declared part
 * cannot tell the two apart.
 *
 * **`open` is not in this table.** Its carrier is the part that opens the overlay, and the contract
 * already names that: `MDY_POPUP_OPENERS[kind].opener`. Restating it here would be a second
 * derivation of one fact, free to drift from the first.
 *
 * The other three are declared because nothing existing answers for them. The catalogue's per-part
 * `states:` is a *class* vocabulary — which element a theme paints `--disabled` on — and it names
 * `inputWrapper` where `aria-disabled` goes on the control, `option` where it goes on the group, and
 * nothing at all for `invalid` in sixteen kinds of seventeen.
 *
 * A set rather than a single part, because a range genuinely has two: an endpoint at each end, and
 * either one alone announces half a field. Silence is not "anywhere" — a kind absent from a state's
 * row exposes it nowhere, and the check says so.
 */
const ARIA_STATE_CARRIERS: { readonly [K in MdyWidgetKind]: Partial<Record<"invalid" | "disabled" | "readonly", readonly MdyWidgetPart<K>[]>> } = Object.freeze({
  text: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  email: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  password: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  textarea: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  number: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  slider: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  checkbox: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  toggle: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  // A radio group and a segmented control have no single labelable element: the group is what is
  // named, and the group is what is invalid or unavailable.
  radio: { invalid: ["group"], disabled: ["group"], readonly: ["group"] },
  segmented: { invalid: ["group"], disabled: ["group"], readonly: ["group"] },
  select: { invalid: ["trigger"], disabled: ["trigger"], readonly: ["trigger"] },
  multiselect: { invalid: ["searchButton"], disabled: ["searchButton"], readonly: ["searchButton"] },
  datepicker: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  daterange: { invalid: ["startControl", "endControl"], disabled: ["startControl", "endControl"], readonly: ["startControl", "endControl"] },
  timepicker: { invalid: ["control"], disabled: ["control"], readonly: ["control"] },
  file: { invalid: ["control"], disabled: ["control"] },
  // Not `control`: the native colour input is a swatch with no readable text, kept for what a form
  // post and an autofill see. The hex field is what the label names and what a user types into, so
  // it is the element the state is about — a renderer is free to hide the swatch from the
  // accessibility tree entirely, and one does.
  colors: { invalid: ["hexInput"], disabled: ["hexInput"], readonly: ["hexInput"] },
});

/**
 * The parts `kind` must expose `state` on, or empty where the state carries no ARIA.
 *
 * Empty is an answer with two meanings the caller must keep apart: a state with no ARIA at all
 * (`focused`, `selected`) and a state this kind does not support. `widgetSupportsState` settles the
 * second before this is asked.
 *
 * Returns part *names*: the table above is what is typed against each kind's anatomy, so a name that
 * is not a part of the kind it is declared under is a compile error there, where it is written.
 */
export function stateCarriers(kind: MdyWidgetKind, state: MdyWidgetState): readonly string[] {
  if (state === "open") {
    const opener = MDY_POPUP_OPENERS[kind as keyof typeof MDY_POPUP_OPENERS];
    return opener ? [opener.opener] : [];
  }
  const row = ARIA_STATE_CARRIERS[kind] as Partial<Record<MdyWidgetState, readonly string[]>>;
  return row[state] ?? [];
}

/**
 * Which states each kind supports.
 *
 * Not every kind has every state, and that is the point — an undeclared state asserted is as much a
 * defect as a declared state unchecked. `aria-readonly="false"` turning up on a slider is the
 * signature of a mechanically applied common ARIA shell, and this table is what makes it findable.
 *
 * `readonly` is declared where a read-only field refuses the change and stays in play. That is every
 * kind whose controller consults `blocksValueChange` — which is every kind with a value — so the
 * earlier reading, that only a typed value can be read-but-not-written, described the renderers
 * before the controllers held the rule. A read-only checkbox does not toggle and a read-only rail
 * does not slide; saying nothing about it left a control that refuses with no way to say why.
 *
 * `file` is the exception, and not because nothing implements it: the picker is the browser's, its
 * value is a `FileList` a page cannot write, and the element's role has no `aria-readonly` to carry.
 * A form that means "this cannot be changed" there says `disabled`.
 *
 * `open` and `loading` belong to the kinds that own an overlay; `selected` to the ones that choose
 * from a set.
 */
const TEXTUAL = ["pristine", "touched", "empty", "filled", "invalid", "disabled", "readonly", "focused"] as const;
const CHOOSER = ["pristine", "touched", "empty", "filled", "invalid", "disabled", "readonly", "focused", "selected"] as const;
const OVERLAY_CHOOSER = [...CHOOSER, "open", "loading"] as const;

export const MDY_WIDGET_STATE_SUPPORT: Readonly<Record<MdyWidgetKind, readonly MdyWidgetState[]>> =
  Object.freeze({
    text: TEXTUAL,
    email: TEXTUAL,
    password: TEXTUAL,
    textarea: TEXTUAL,
    number: TEXTUAL,
    // A slider always has a value, so it is never empty and never pristine-without-value.
    slider: ["pristine", "touched", "filled", "invalid", "disabled", "readonly", "focused"],
    // A boolean is on or off. "Empty" is not a state it can be in.
    checkbox: ["pristine", "touched", "filled", "invalid", "disabled", "readonly", "focused", "selected"],
    toggle: ["pristine", "touched", "filled", "invalid", "disabled", "readonly", "focused", "selected"],
    radio: CHOOSER,
    segmented: CHOOSER,
    select: OVERLAY_CHOOSER,
    multiselect: OVERLAY_CHOOSER,
    datepicker: [...CHOOSER, "open"],
    daterange: [...CHOOSER, "open"],
    timepicker: [...CHOOSER, "open"],
    // A file input's value is a FileList the page cannot write, and its element's role has no
    // `aria-readonly` to carry; and the browser owns the picker, so there is no `open` the contract
    // can observe.
    file: ["pristine", "touched", "empty", "filled", "invalid", "disabled", "focused"],
    colors: [...CHOOSER, "open"],
  });

/**
 * The parts that belong to the open overlay rather than to the resting widget.
 *
 * The static and the dynamic contract were conflated: `datepicker` and `daterange` mount their
 * grids and overlays while *closed*, which is predictable but costly on a large form, and — worse
 * for a specification — left no way to say whether that was required or merely what today's
 * renderers happen to do.
 *
 * Splitting it says: these parts are the *open* contract. A closed widget is not required to render
 * any of them, so a renderer that later mounts its overlay lazily is not breaking the contract, and
 * one that mounts eagerly is not breaking it either. What both must do is render them when open.
 *
 * Read together with a node's `optional`, which is a statement about a part's place rather than about
 * the widget's whole lifetime: six kinds declare a required part inside an optional `popup`, and the
 * two are consistent only under that reading — required *while its parent is on the page*.
 *
 * The same question as {@link dynamicParts}, and now the same answer. This walked the anatomy itself,
 * rooting on the part *named* `popup` where the other roots on the part whose *element is* `popup`;
 * the two agreed on all seventeen kinds only because every popup-element part happens to sit inside
 * the one called `popup`. Two derivations of one rule can only be kept honest by luck, and the other
 * is the one with the fixed-point walk and the test that runs it over unordered anatomies.
 */
export function overlayOnlyParts(kind: MdyWidgetKind): readonly string[] {
  return dynamicParts(kind);
}

/**
 * How a kind shows that it is unusable or wrong — the visual half of `disabled` and `error`.
 *
 * Two mechanisms are in use and both are legitimate:
 *
 * - **`"class"`** — a modifier on the field's wrapper, `mdy-input-wrapper--disabled`. Ten kinds,
 *   every one whose wrapper *is* `mdy-input-wrapper`.
 * - **`"structural"`** — a theme rule that reaches the state through the DOM instead, because the
 *   kind's wrapper is its own (`mdy-checkbox`, `mdy-slider-container`, `mdy-radio-group`…) and the
 *   native control below it already carries the truth: `.mdy-checkbox__control:disabled +
 *   .mdy-checkbox__indicator`, `:has([aria-invalid="true"])`.
 *
 * Declared rather than inferred, and this is the point of the table. `widgetStateClasses` — what the
 * style audit compares a theme against — can only see the first mechanism, so for the seven kinds
 * using the second, half the expression of "this field is unusable" sat outside everything this
 * repository checks. An audit that cannot see a mechanism cannot tell a kind that *shows* it is
 * disabled from one that merely claims to.
 *
 * Giving those seven wrappers `disabled`/`error` state classes instead would be the wrong fix twice
 * over: it mints seven classes no theme paints, and it contradicts `statesFor`'s rule that a part
 * redeclaring its class to something different does not inherit the shell's states.
 *
 * **This declares what a kind is expected to do, not what the themes were found doing.** `file`
 * says `"structural"` and no theme currently reaches it at all — that is the declaration working:
 * the gap is reported instead of being written down as intended.
 */
export const MDY_STATE_EXPRESSION: Readonly<Record<MdyWidgetKind, "class" | "structural">> =
  Object.freeze({
    text: "class", email: "class", password: "class", textarea: "class", number: "class",
    select: "class", datepicker: "class", daterange: "class", timepicker: "class", colors: "class",
    // Their wrapper is their own, so the modifier would be a class nothing paints.
    checkbox: "structural", toggle: "structural", segmented: "structural", multiselect: "structural",
    // The control carries it: `.mdy-slider:disabled`, not the container around it.
    slider: "structural",
    // On the option, not the group. A disabled radio *group* is not the same claim as a disabled
    // radio, and only the second is currently expressed.
    radio: "structural",
    file: "structural",
  });

/** Whether a kind declares a state. */
export function widgetSupportsState(kind: MdyWidgetKind, state: MdyWidgetState): boolean {
  return MDY_WIDGET_STATE_SUPPORT[kind].includes(state);
}

/** How many kind × state pairs the contract declares — the matrix's size. */
export function widgetStateMatrixSize(): number {
  return Object.values(MDY_WIDGET_STATE_SUPPORT).reduce((total, states) => total + states.length, 0);
}
