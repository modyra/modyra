/**
 * Who holds focus, and who gets it back.
 *
 * Moving focus is easy and losing it is silent. A widget opens an overlay, focus goes into it, the
 * overlay closes — and if nothing takes focus at that moment the user is standing on `<body>`, at
 * the top of the document, with no way back to the field they were in. Nothing throws, nothing
 * logs, and every attribute is still correct.
 *
 * This module makes the handover a contract with two halves:
 *
 * **Focus is borrowed, not taken.** {@link MdyFocusCustodian.remember} records who holds it before
 * the widget moves it, so there is always somewhere to hand it back to. A widget that never asks is
 * a widget that cannot return it.
 *
 * **A move that is not taken did not happen.** `focus()` on a detached, hidden or disabled element
 * does nothing at all and reports nothing — so every candidate is *verified* afterwards against
 * `activeElement`, and a candidate that did not take it falls through to the next. This is the half
 * that matters: the reason focus ends up on `<body>` is almost never that nobody asked, it is that
 * the element asked was gone by the time the question reached it.
 *
 * The chain is: the part the caller prefers, then whoever held focus before, then the widget itself.
 * Only when a widget has left the document entirely does focus legitimately go nowhere.
 */

/** Something that can be focused and asked whether it took it. */
type Focusable = HTMLElement;

export interface MdyFocusCustodian {
  /**
   * Record the current focus owner, to be handed back by a later {@link restore}.
   *
   * Call it *before* moving focus — on open, on expand, before anything is mounted over the top.
   * Calling it twice without an intervening restore keeps the first answer: the owner worth
   * returning to is the one from outside the interaction, not an element the widget focused itself
   * one step ago.
   */
  remember(): void;
  /**
   * Hand focus to `preferred`, or to the best thing that will take it.
   *
   * Returns the element that ended up with focus, or `null` when nothing did — which happens only
   * if the widget and its remembered owner have both left the document.
   */
  restore(preferred?: Element | null): HTMLElement | null;
  /** Forget the recorded owner. For teardown, so a destroyed widget holds no reference. */
  release(): void;
}

/** Whether an element is in the document and could plausibly take focus. */
function isReachable(element: Element | null | undefined): element is Focusable {
  if (!element || !(element as HTMLElement).focus) return false;
  const el = element as HTMLElement;
  if (!el.isConnected) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  for (let cursor: HTMLElement | null = el; cursor; cursor = cursor.parentElement) {
    if (cursor.hidden) return false;
  }
  return true;
}

/**
 * The first thing inside `root` that can take focus, as a last resort.
 *
 * Deliberately not a full tabbability implementation: this is the fallback of a fallback, and the
 * question it answers is "is there anywhere in this widget to stand", not "what would Tab do next".
 */
function firstFocusableWithin(root: Element): Focusable | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    "button, input, select, textarea, a[href], [tabindex]",
  );
  for (const candidate of Array.from(candidates)) {
    if (isReachable(candidate) && candidate.getAttribute("tabindex") !== "-1") return candidate;
  }
  return isReachable(root) ? (root as HTMLElement) : null;
}

/**
 * A focus custodian for one widget.
 *
 * `root` is a function because a widget's root can be replaced — a re-render, a remount — and a
 * custodian holding a stale element would restore focus into a detached tree, which looks exactly
 * like restoring it nowhere.
 */
export function createFocusCustodian(root: () => Element | null): MdyFocusCustodian {
  let previous: Element | null = null;

  const documentOf = (): Document | null => root()?.ownerDocument ?? null;

  const takes = (candidate: Element): boolean => {
    if (!isReachable(candidate)) return false;
    const document_ = candidate.ownerDocument;
    (candidate as HTMLElement).focus();
    // The verification the whole module exists for. `focus()` is silent when it fails.
    const active = document_?.activeElement;
    return active === candidate || (active !== null && candidate.contains(active as Node));
  };

  return {
    remember(): void {
      if (previous && (previous as HTMLElement).isConnected) return;
      const active = documentOf()?.activeElement ?? null;
      previous = active && active !== documentOf()?.body ? active : null;
    },

    restore(preferred?: Element | null): HTMLElement | null {
      const current = root();
      const chain = [preferred, previous, current ? firstFocusableWithin(current) : null];
      for (const candidate of chain) {
        if (candidate && takes(candidate)) {
          previous = null;
          return candidate as HTMLElement;
        }
      }
      return null;
    },

    release(): void {
      previous = null;
    },
  };
}
