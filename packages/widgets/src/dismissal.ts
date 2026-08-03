/**
 * Light dismiss: when an interaction outside an open overlay closes it.
 *
 * The rule is about an *interaction*, not an event. An interaction has an origin and a completion,
 * and both decide:
 *
 * > An overlay closes when a primary interaction that **began** outside its logical branch is
 * > **completed** outside that branch. An interaction that began inside never dismisses, however
 * > far outside it ends.
 *
 * That asymmetry is the point. Selecting text in a popup and releasing past its edge is a drag from
 * inside; a browser fires the resulting `click` on a common ancestor, so any rule reading only the
 * completion target closes a popup the user was working in.
 *
 * **Completion is `click`, not `pointerup`.** A drag that ends on a different element than it began
 * on produces no `click` at all — which is precisely the gesture a touch user makes to scroll the
 * page behind an open popup. Completing on `pointerup` would dismiss there; completing on `click`
 * leaves the browser to decide what counts as an activation, and the origin/end pair only prevents
 * the false positives it cannot see.
 *
 * What this deliberately does **not** do:
 *
 * - it never treats `focusout` as an outside interaction. Focus leaving is a different question with
 *   a different answer, and letting it close would reinstate, through a second path, exactly the
 *   dismissals the origin check refuses;
 * - it does not act on secondary pointers or non-primary buttons. A right-click opens a context
 *   menu; closing the popup underneath it is not what the user asked for;
 * - it does not pair events from different pointers. A second finger's `pointerup` does not complete
 *   the first finger's interaction.
 *
 * "Inside" is the **logical branch**, not the popup element: the invoker that opens it, the popup,
 * its descendants, any portalled content and any child popup all count as inside. A renderer supplies
 * that predicate because only it knows where its portal went; the rule itself is here, so no renderer
 * decides when a pointer dismisses.
 */

/** What a widget declares. One name, because these invariants do not vary by kind. */
export type MdyOutsideDismiss = false | "light-dismiss";

/** Where an interaction is, relative to the overlay's logical branch. */
export type MdyDismissalPhase =
  | "idle"
  | "tracking-inside"
  | "tracking-outside"
  | "cancelled"
  | "dismissed";

/** The pointer facts the rule reads. A renderer passes the event's own values, unmodified. */
export interface MdyPointerOrigin {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  readonly button: number;
}

/**
 * Whether a press begins an interaction the rule will act on.
 *
 * Primary pointer, primary button. Everything else — a right-click, the middle button, a second
 * finger — is a different gesture, and a rule that dismissed on it would close a popup underneath a
 * context menu the user just asked for.
 */
export function isPrimaryInteraction(origin: MdyPointerOrigin): boolean {
  return origin.isPrimary && origin.button === 0;
}

export interface MdyLightDismissOptions {
  /** True when the target lies within the overlay's logical branch — invoker, popup, portal, child popups. */
  readonly isInside: (target: unknown) => boolean;
  /** Called at most once per interaction, when one completes entirely outside. */
  readonly dismiss: () => void;
  /** Whether the overlay is open. An interaction beginning while closed decides nothing. */
  readonly isOpen: () => boolean;
}

export interface MdyLightDismiss {
  /** Capture-phase `pointerdown`. Records the origin. */
  readonly pointerdown: (target: unknown, origin: MdyPointerOrigin) => void;
  /** Capture-phase `click`. Completes the interaction and decides. */
  readonly click: (target: unknown) => void;
  /** Capture-phase `pointercancel`. The browser took the gesture; nothing is decided. */
  readonly pointercancel: (pointerId: number) => void;
  /** Abandons any interaction in flight — window blur, document hidden, unmount. */
  readonly reset: () => void;
  /** The current phase, for tests and for a renderer that wants to reflect it. */
  readonly phase: () => MdyDismissalPhase;
}

/**
 * The state machine.
 *
 * `idle` is the only state a `click` cannot dismiss from, and that matters: a click with no observed
 * pointer interaction — a keyboard activation, a `.click()` from application code — is not an outside
 * *pointer* interaction and must not satisfy a capability that says it is.
 */
export function createLightDismiss(options: MdyLightDismissOptions): MdyLightDismiss {
  let phase: MdyDismissalPhase = "idle";
  let tracked: number | null = null;

  const toIdle = (): void => {
    phase = "idle";
    tracked = null;
  };

  return {
    pointerdown: (target, origin) => {
      // A press always supersedes an interaction still in flight: two presses cannot both be
      // pending, and leaving the first armed would let a later completion resolve the wrong one.
      if (!options.isOpen() || !isPrimaryInteraction(origin)) {
        toIdle();
        return;
      }
      tracked = origin.pointerId;
      phase = options.isInside(target) ? "tracking-inside" : "tracking-outside";
    },

    click: (target) => {
      const from = phase;
      toIdle();
      if (from !== "tracking-outside") return;
      if (!options.isOpen() || options.isInside(target)) return;
      phase = "dismissed";
      options.dismiss();
      phase = "idle";
    },

    pointercancel: (pointerId) => {
      if (tracked !== null && pointerId !== tracked) return;
      phase = "cancelled";
      tracked = null;
      phase = "idle";
    },

    reset: toIdle,
    phase: () => phase,
  };
}
