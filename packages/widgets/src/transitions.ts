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
 * `transitions.spec.mjs` holds {@link overlayLifecycleTransition} — the one every renderer routes
 * through — and {@link widgetKeyIntent} to it.
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
    //
    // Except where the opener is the control the user types into. A press there is the user placing
    // the caret, and answering it by closing the calendar takes the field away at the moment they
    // reached for it. The rule was written for a button and applied to every opener alike, and one
    // renderer implemented it literally while another did not — so the same click did different
    // things depending on who drew the widget, with the contract endorsing the worse of the two.
    ...(opener.typeable
      ? []
      : [{ from: "open" as const, trigger: { type: "pointer" as const, part: opener.opener }, to: "closed" as const }]),
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

/**
 * What a key does, per kind.
 *
 * `widgetKeyIntent` answered this for years without asking which widget it was looking at: every
 * kind but `number` was told ArrowDown means "move to the next option", so a text field navigated a
 * list it does not have, a textarea was told Enter opens something, and a slider — whose arrows must
 * change its value — was given list navigation instead of a step.
 *
 * What a key may do follows from what the kind *is*: a widget with options navigates them, one with
 * a range steps it, one with two states toggles, one with an overlay opens and closes it. Declaring
 * that per kind is what stops the answer from being the same everywhere.
 */
export interface MdyKeyBinding {
  readonly key: string;
  /** Only when the overlay is showing, only when it is not, or either way. */
  readonly when?: MdyOverlayPhase;
  readonly intent: "move" | "step" | "toggle" | "open" | "commit" | "cancel";
  /**
   * Whether dismissing on this key returns focus to the opener. Only a `cancel` dismisses, so only a
   * `cancel` answers it, and the default is to restore.
   *
   * The two dismissals differ, and the difference is the whole reason this is declared rather than
   * assumed. Escape means *put me back where I was*, so focus returns to the opener. Tab is already
   * carrying focus to the next control, and pulling it back would trap the user in the field they
   * just left — the same key, the same close, the opposite answer.
   */
  readonly restoresFocus?: boolean;
}

/** Kinds whose value is chosen from a list the keyboard walks. */
const NAVIGATES_OPTIONS: readonly string[] = Object.freeze([
  "select", "multiselect", "radio", "segmented", "datepicker", "daterange", "timepicker", "colors",
]);
/** Kinds whose value is a point on a range the keyboard nudges. */
const STEPS_A_RANGE: readonly string[] = Object.freeze(["number", "slider"]);
/** Kinds with exactly two states, which Space flips. */
const TOGGLES: readonly string[] = Object.freeze(["checkbox", "toggle", "radio", "segmented"]);

function keyboardFor(kind: MdyWidgetKind): readonly MdyKeyBinding[] {
  const overlay = MDY_WIDGET_CONTRACTS[kind].capabilities.overlay;
  const bindings: MdyKeyBinding[] = [];

  if (overlay) {
    bindings.push({ key: "Escape", when: "open", intent: "cancel", restoresFocus: true });
    // Tab dismisses without taking focus back. Leaving it undeclared did not make the list stay
    // open — it made the *table* disagree with the policy the renderers actually call, so a renderer
    // built from the declared bindings alone left a popup floating over a form the user had left.
    bindings.push({ key: "Tab", when: "open", intent: "cancel", restoresFocus: false });
    bindings.push({ key: "Enter", when: "closed", intent: "open" });
    bindings.push({ key: "Enter", when: "open", intent: "commit" });
    // The combobox pattern: pressing down on a closed control opens it rather than doing nothing,
    // which is how a keyboard user reaches the list at all.
    bindings.push({ key: "ArrowDown", when: "closed", intent: "open" });
    // Space opens too — but only where the opener is not a control the user types into. In a text
    // field the space bar is a space character, and a widget that opened its calendar instead would
    // be unable to accept "12 March". The keyboard policy has opened on Space for as long as it has
    // existed and this table claimed the key for nothing, so the two disagreed in the same way they
    // did over Tab; declaring it needed the opener to be able to say what it is.
    if (!MDY_POPUP_OPENERS[kind]?.typeable) {
      bindings.push({ key: " ", when: "closed", intent: "open" });
    }
  }
  if (NAVIGATES_OPTIONS.includes(kind)) {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      bindings.push({ key, ...(overlay ? { when: "open" as const } : {}), intent: "move" });
    }
  }
  if (STEPS_A_RANGE.includes(kind)) {
    // Only the arrows. Home and End on a range mean "go to the minimum" and "to the maximum", and
    // the intent vocabulary has no word for that — declaring them as `step` would say something
    // untrue rather than leave a gap on the record.
    bindings.push({ key: "ArrowUp", intent: "step" }, { key: "ArrowDown", intent: "step" });
  }
  if (TOGGLES.includes(kind)) bindings.push({ key: " ", intent: "toggle" });

  return Object.freeze(bindings);
}

/** Every key each kind answers to. A kind that answers to none declares none. */
export const MDY_WIDGET_KEYBOARD: Readonly<Record<MdyWidgetKind, readonly MdyKeyBinding[]>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).map((kind) => [kind, keyboardFor(kind)]),
    ) as Record<MdyWidgetKind, readonly MdyKeyBinding[]>,
  );

/** What this kind does with this key in this phase, or `null` if it does not claim it. */
export function keyBindingFor(
  kind: MdyWidgetKind,
  key: string,
  open: boolean,
): MdyKeyBinding | null {
  const phase: MdyOverlayPhase = open ? "open" : "closed";
  return MDY_WIDGET_KEYBOARD[kind].find(
    (binding) => binding.key === key && (binding.when === undefined || binding.when === phase),
  ) ?? null;
}
