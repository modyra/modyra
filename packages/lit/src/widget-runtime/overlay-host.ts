/**
 * Overlay lifecycle for the Lit elements that own a popup.
 *
 * Every decision — whether a toggle opens, whether Escape or a pointer outside closes, whether
 * focus is restored — is `overlayLifecycleTransition` in `@modyra/widgets`. These helpers only
 * carry the element's `_open` flag in and out of it, so no element re-decides the policy locally.
 */
import { blocksFocus, createLightDismiss, MDY_WIDGET_CONTRACTS, overlayLifecycleTransition, type MdyOverlayLifecycleIntent, bindLightDismiss } from "@modyra/widgets";
import type { MdyInteractivity } from "@modyra/core";

/** A teardown for the case where nothing was bound. */
const noop = (): void => undefined;

export interface OverlayHost {
  /** Current open state; assigning it triggers the element's own update. */
  _open: boolean;
  contains(node: Node): boolean;
}

/** Applies an intent and returns the transition the policy produced. */
export function applyOverlayIntent(host: OverlayHost, intent: MdyOverlayLifecycleIntent) {
  const transition = overlayLifecycleTransition({ open: host._open }, intent);
  host._open = transition.state.open;
  return transition;
}

/**
 * Whether the contract asks for outside-gesture dismissal at all.
 *
 * Not a per-renderer choice, and neither is the gesture: `createOutsidePointerGesture` holds the
 * rule and this package consumes it. Every overlay kind declares the same one, so asking any of them
 * is asking the contract.
 */
export function outsideDismissDeclared(): boolean {
  return MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnOutsidePointer !== false;
}

/**
 * Dismisses the host's overlay when a gesture completes outside it — the default every widget with
 * `capabilities.dismissOnOutsidePointer` declares. Returns the teardown.
 */
export function bindOutsidePointer(
  host: OverlayHost,
  onClose: () => void,
): () => void {
  // Nothing declared: no listeners, and a teardown that has nothing to undo.
  if (!outsideDismissDeclared()) return noop;

  const policy = createLightDismiss({
    isOpen: () => host._open,
    // Duck-typed: `Node` is not a global in every host this package runs in.
    isInside: (target: unknown) => {
      const node = target as Node | null;
      return node !== null && typeof node === "object"
        && typeof (node as { nodeType?: unknown }).nodeType === "number"
        && host.contains(node);
    },
    dismiss: () => {
      const transition = applyOverlayIntent(host, { type: "outside", outside: true });
      if (transition.effect === "teardown") onClose();
    },
  });

  return bindLightDismiss(policy);
}

/**
 * Carries out what a controller asks of the DOM, for an element whose popup this package owns.
 *
 * The three commands an overlay widget produces — open, close, give focus back — are the same three
 * for every kind, and each renderer that adopted a controller wrote the same loop: the date picker,
 * the range picker and the clock had it byte-identical the moment the third one landed. What a kind
 * *decides* differs; what a popup does when told is not a per-kind question.
 */
export function applyWidgetCommands(
  host: OverlayHost & { querySelector<E extends Element>(selectors: string): E | null },
  commands: ReadonlyArray<{ readonly type: string }>,
  options: {
    /** Opens the popup this host owns. */
    readonly open: () => void;
    /** Closes it. */
    readonly close: () => void;
    /** Whether the field refuses interaction, which decides if an open is honoured at all. */
    readonly disabled: boolean;
    /** The selector focus returns to, which is the control the popup hangs off. */
    readonly control: string;
  },
): void {
  for (const command of commands) {
    if (command.type === "open-overlay") {
      applyOverlayIntent(host, { type: "open", disabled: options.disabled, available: true });
      options.open();
    }
    if (command.type === "close-overlay") {
      applyOverlayIntent(host, { type: "close" });
      options.close();
    }
    if (command.type === "restore-focus") {
      host.querySelector<HTMLInputElement>(options.control)?.focus();
    }
  }
}

/**
 * Closes the popup this host paints when its field is out of play.
 *
 * A field leaves play without anybody clicking anything — a rule takes it out when another field
 * changes — and an element that only writes `_open` in answer to a gesture goes on painting an
 * overlay nothing can answer: every cell drawn, the opener still reporting `aria-expanded="true"`,
 * and every click correctly landing nowhere.
 *
 * `blocksFocus` draws the line, so `readonly` keeps its popup: a value the user may read but not
 * rewrite is one they are still allowed to look at.
 */
export function closeOverlayOutOfPlay(
  host: OverlayHost,
  interactivity: MdyInteractivity,
  close: () => void,
): void {
  if (!host._open || !blocksFocus(interactivity)) return;
  host._open = false;
  close();
}
