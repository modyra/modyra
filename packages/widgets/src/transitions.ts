/**
 * What a widget *does*, as against what it is.
 *
 * Dimension 5 of the specification. The anatomy says a select has a popup and the state contract
 * says it may be open; neither says that clicking the trigger opens it, that Escape closes it, or
 * that closing puts focus back where the user left it. Those are the parts of a widget a user
 * actually experiences, and they were expressed only as the behaviour of two shared functions.
 *
 * Declared independently of those functions on purpose. A table derived from the implementation
 * checks nothing; this states what the transitions are supposed to be, and
 * `transitions.spec.mjs` holds {@link overlayLifecycleTransition} and {@link widgetKeyIntent} to it.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";

/** What the user did. */
export type MdyTransitionTrigger =
  /** A pointer press on a part. */
  | { readonly type: "pointer"; readonly part: string }
  | { readonly type: "key"; readonly key: string }
  /** A pointer press anywhere outside the widget. */
  | { readonly type: "outside" };

/** Whether the widget's overlay is showing. The only lifecycle state a transition moves between. */
export type MdyOverlayPhase = "open" | "closed";

export interface MdyWidgetTransition {
  readonly from: MdyOverlayPhase;
  readonly trigger: MdyTransitionTrigger;
  readonly to: MdyOverlayPhase;
  /**
   * Whether closing returns focus to the opener.
   *
   * Only the *deliberate* dismissals restore it. A pointer landing outside moved the user's
   * attention somewhere themselves, and pulling focus back from wherever they clicked is the
   * behaviour that makes an overlay feel like a trap.
   */
  readonly restoresFocus?: boolean;
}

/**
 * A disabled widget does not transition at all.
 *
 * Stated as data rather than left implicit: "nothing happens" is a behaviour a renderer has to
 * implement, and a disabled trigger that still opens its popup is a real defect that looks like no
 * transition being declared.
 */
export const MDY_DISABLED_BLOCKS_TRANSITIONS = true;

function transitionsFor(kind: MdyWidgetKind): readonly MdyWidgetTransition[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const opener = MDY_POPUP_OPENERS[kind];
  if (!definition.capabilities.overlay || !opener) return Object.freeze([]);

  const transitions: MdyWidgetTransition[] = [
    { from: "closed", trigger: { type: "pointer", part: opener.opener }, to: "open" },
    // The same press again closes it: an opener is a toggle, not a one-way switch.
    { from: "open", trigger: { type: "pointer", part: opener.opener }, to: "closed" },
    { from: "open", trigger: { type: "key", key: "Escape" }, to: "closed", restoresFocus: true },
  ];

  if (definition.capabilities.dismissOnOutsidePointer) {
    transitions.push({ from: "open", trigger: { type: "outside" }, to: "closed" });
  }

  return Object.freeze(transitions);
}

/** Every transition each kind admits. A kind with no overlay declares none — yet. */
export const MDY_WIDGET_TRANSITIONS: Readonly<Record<MdyWidgetKind, readonly MdyWidgetTransition[]>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).map((kind) => [kind, transitionsFor(kind)]),
    ) as Record<MdyWidgetKind, readonly MdyWidgetTransition[]>,
  );

/** The transitions a kind admits from a given phase. */
export function transitionsFrom(
  kind: MdyWidgetKind,
  phase: MdyOverlayPhase,
): readonly MdyWidgetTransition[] {
  return MDY_WIDGET_TRANSITIONS[kind].filter((transition) => transition.from === phase);
}
