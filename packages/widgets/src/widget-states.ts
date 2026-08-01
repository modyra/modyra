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
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";

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
   * Declared rather than implied. `disabled` and `readonly` render almost identically and behave
   * completely differently, and for a long time Modyra rendered the difference while behaving
   * identically — both were submitted, both were validated. A contract that only describes
   * attributes cannot catch that, because nothing about the markup is wrong.
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
    // The two states that look alike and are not. A disabled field is a question the form is not
    // asking; a read-only one is a question it has answered on the user's behalf.
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
 * Which states each kind supports.
 *
 * Not every kind has every state, and that is the point — an undeclared state asserted is as much a
 * defect as a declared state unchecked. `aria-readonly="false"` turning up on a slider is the
 * signature of a mechanically applied common ARIA shell, and this table is what makes it findable.
 *
 * `readonly` is declared only where the concept means something: a control whose value is typed can
 * be read-but-not-written. A checkbox, a slider or a file input has no read-only rendering — it is
 * either operable or disabled — so `readonly` is *absent* rather than false.
 *
 * `open` and `loading` belong to the kinds that own an overlay; `selected` to the ones that choose
 * from a set.
 */
const TEXTUAL = ["pristine", "touched", "empty", "filled", "invalid", "disabled", "readonly", "focused"] as const;
const CHOOSER = ["pristine", "touched", "empty", "filled", "invalid", "disabled", "focused", "selected"] as const;
const OVERLAY_CHOOSER = [...CHOOSER, "open", "loading"] as const;

export const MDY_WIDGET_STATE_SUPPORT: Readonly<Record<MdyWidgetKind, readonly MdyWidgetState[]>> =
  Object.freeze({
    text: TEXTUAL,
    email: TEXTUAL,
    password: TEXTUAL,
    textarea: TEXTUAL,
    number: TEXTUAL,
    // A slider always has a value, so it is never empty and never pristine-without-value; and it
    // has no read-only rendering — a rail you cannot drag is a disabled rail.
    slider: ["pristine", "touched", "filled", "invalid", "disabled", "focused"],
    // A boolean is on or off. "Empty" is not a state it can be in, and read-only would be a
    // checkbox you can focus but not toggle, which is what disabled already means.
    checkbox: ["pristine", "touched", "filled", "invalid", "disabled", "focused", "selected"],
    toggle: ["pristine", "touched", "filled", "invalid", "disabled", "focused", "selected"],
    radio: CHOOSER,
    segmented: CHOOSER,
    select: OVERLAY_CHOOSER,
    multiselect: OVERLAY_CHOOSER,
    datepicker: [...CHOOSER, "open"],
    daterange: [...CHOOSER, "open"],
    timepicker: [...CHOOSER, "open"],
    // A file input's value is a FileList the page cannot write, so read-only has no meaning; and
    // the browser owns the picker, so there is no `open` the contract can observe.
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
 */
export function overlayOnlyParts(kind: MdyWidgetKind): readonly string[] {
  const { structure } = MDY_WIDGET_CONTRACTS[kind];
  const parentOf = new Map(structure.nodes.map((node) => [node.part as string, node.parent as string | undefined]));
  const out: string[] = [];
  for (const node of structure.nodes) {
    let cursor: string | undefined = node.part as string;
    while (cursor) {
      if (cursor === "popup") { out.push(node.part as string); break; }
      cursor = parentOf.get(cursor);
    }
  }
  return out;
}

/** Whether a kind declares a state. */
export function widgetSupportsState(kind: MdyWidgetKind, state: MdyWidgetState): boolean {
  return MDY_WIDGET_STATE_SUPPORT[kind].includes(state);
}

/** How many kind × state pairs the contract declares — the matrix's size. */
export function widgetStateMatrixSize(): number {
  return Object.values(MDY_WIDGET_STATE_SUPPORT).reduce((total, states) => total + states.length, 0);
}
