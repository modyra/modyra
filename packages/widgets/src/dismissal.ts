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
 * **Completion is the pointer's own release.** `pointerup` decides, and `click` is the tail that
 * catches an interaction whose release never arrived.
 *
 * It was `click` alone, on the reasoning that a drag ending elsewhere produces no click — the gesture
 * a touch user makes to scroll the page behind an open popup — so the browser's own judgement of what
 * counts as an activation would filter it out. One engine does not supply that judgement: WebKit
 * synthesises no mouse events and no `click` for a tap on an element it does not consider clickable,
 * a page's own background included. On Safari the pair never completed and nothing dismissed.
 *
 * What actually protects the scroll gesture is `pointercancel`: a browser that takes a gesture over
 * to scroll says so, and this rule already treats that as abandonment. The absence of a click was
 * standing in for a signal that is delivered directly.
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
 * its descendants, any portalled content and any child popup all count as inside. A renderer names
 * the branch's roots and {@link overlayBranchContains} decides membership, so neither the boundary
 * nor the moment is a renderer's to define.
 */
import { overlayBranchContains, type MdyOverlayBranch } from "./overlay-branch.js";

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
  /** The overlay's logical branch — invoker, popup, portal, child popups. */
  readonly branch: MdyOverlayBranch | (() => MdyOverlayBranch);
  /** Called at most once per interaction, when one completes entirely outside. */
  readonly dismiss: () => void;
  /** Whether the overlay is open. An interaction beginning while closed decides nothing. */
  readonly isOpen: () => boolean;
}

export interface MdyLightDismiss {
  /** Capture-phase `pointerdown`. Records the origin. */
  readonly pointerdown: (target: unknown, origin: MdyPointerOrigin) => void;
  /** Capture-phase `pointerup`. Completes the interaction and decides. */
  readonly pointerup: (target: unknown, pointerId?: number) => void;
  /**
   * Capture-phase `click`. Completes the interaction and decides.
   *
   * Normally a no-op: the release has already resolved the interaction and left the machine idle, and
   * an idle machine never dismisses. It stays because a click can arrive where no `pointerup` did —
   * pointer capture released elsewhere, a synthetic activation — and losing the dismissal there would
   * trade one engine's gap for another's.
   */
  readonly click: (target: unknown) => void;
  /** Capture-phase `pointercancel`. The browser took the gesture; nothing is decided. */
  readonly pointercancel: (pointerId: number) => void;
  /** Abandons any interaction in flight — window blur, document hidden, unmount. */
  readonly reset: () => void;
  /** The current phase, for tests and for a renderer that wants to reflect it. */
  readonly phase: () => MdyDismissalPhase;
  /**
   * Whether an interaction that began **inside** the branch is still unresolved.
   *
   * The precedence rule between the two dismissal paths: while this is true, focus leaving the
   * branch must not close the overlay. A drag out of a popup moves focus out of it, and closing on
   * that would reinstate — through the focus path — exactly the dismissal the pointer rule refuses.
   */
  readonly interactionFromInside: () => boolean;
}

/**
 * The state machine.
 *
 * `idle` is the only state a `click` cannot dismiss from, and that matters: a click with no observed
 * pointer interaction — a keyboard activation, a `.click()` from application code — is not an outside
 * *pointer* interaction and must not satisfy a capability that says it is.
 */
export function createLightDismiss(options: MdyLightDismissOptions): MdyLightDismiss {
  // Read per interaction rather than captured: a renderer's roots are view children that do not
  // exist when the rule is built, and a branch resolved once would hold the nulls it saw then.
  const inside = (target: unknown): boolean =>
    overlayBranchContains(typeof options.branch === "function" ? options.branch() : options.branch, target);
  let phase: MdyDismissalPhase = "idle";
  let tracked: number | null = null;

  const toIdle = (): void => {
    phase = "idle";
    tracked = null;
  };

  /**
   * Resolve the interaction in flight, whichever event marks its end.
   *
   * Idempotent by construction: it leaves the machine idle, and an idle machine dismisses nothing.
   * That is what lets `pointerup` and `click` both call it on the engines that send both.
   */
  const complete = (target: unknown): void => {
    const from = phase;
    toIdle();
    if (from !== "tracking-outside") return;
    if (!options.isOpen() || inside(target)) return;
    phase = "dismissed";
    options.dismiss();
    phase = "idle";
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
      phase = inside(target) ? "tracking-inside" : "tracking-outside";
    },

    pointerup: (target, pointerId) => {
      // Another pointer's release does not complete this interaction — a second finger lifting is
      // not the first one's answer.
      if (pointerId !== undefined && tracked !== null && pointerId !== tracked) return;
      complete(target);
    },

    click: (target) => complete(target),

    pointercancel: (pointerId) => {
      if (tracked !== null && pointerId !== tracked) return;
      phase = "cancelled";
      tracked = null;
      phase = "idle";
    },

    reset: toIdle,
    phase: () => phase,
    interactionFromInside: () => phase === "tracking-inside",
  };
}
