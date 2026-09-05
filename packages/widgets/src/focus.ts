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
   * Only while the custodian is holding focus it borrowed. A widget that closes and is then disposed
   * restores twice, and the second call must not pull focus back out of wherever the first one put
   * it — focus is borrowed, not taken. A `preferred` element is always honoured: naming one is the
   * caller placing focus deliberately rather than asking for what was borrowed.
   *
   * Returns the element that ended up with focus, or `null` when nothing did — because the widget
   * and its remembered owner have both left the document, or because there was nothing to give back.
   */
  restore(preferred?: Element | null): HTMLElement | null;
  /**
   * End the borrow. For teardown, so a destroyed widget holds no reference and owes no restore.
   *
   * A {@link restore} after this places no focus and returns `null` unless it names a `preferred`
   * element — the widget has said it is done, and taking focus afterwards is what this module exists
   * to prevent.
   */
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
 * Keeps the keyboard somewhere when the control it was standing on leaves play.
 *
 * Disabling a focused element blurs it — that is the platform. What follows is this library's: the
 * person who was typing is on `<body>`, their next Tab starts at the top of the document, and
 * nothing says where they went. A document's rule can do this without anyone clicking: a value
 * arrives from a fetch, a condition turns false, and the field under the cursor goes out of play
 * mid-word.
 *
 * Read-only is the proof that it need not cost them their place — a read-only field keeps the
 * keyboard — so this puts a disabled one somewhere too: the next thing that can take focus after it,
 * the previous one otherwise, and the widget's own root as the last resort so the next Tab starts
 * from where they were rather than from the top of the page.
 *
 * Call it *before* taking the control out of play: afterwards the element is already blurred and
 * there is nothing left to say where the keyboard was.
 */
export function keepKeyboardInPlay(
  leaving: Element,
  scope?: Element | null,
  options?: {
    /**
     * Whether this widget held the keyboard, **observed before the control left play**.
     *
     * A caller that takes a control out of play itself need not pass it: the keyboard is still on
     * the element and this function can see it. A caller that hears about it afterwards cannot —
     * the platform has already blurred it, focus rests on nothing, and nothing distinguishes that
     * from a field nobody was ever standing in. Putting focus on such a widget's root moves the
     * keyboard to a control the person never visited.
     *
     * So the fact is supplied rather than asserted. It used to be a boolean meaning "I am asking
     * after a blur", which is a claim about where the *caller* stands in time — true from inside a
     * blur handler and false from a render effect, with nothing in the value to tell them apart.
     * A caller that has not looked has nothing to pass here.
     */
    readonly heldTheKeyboard?: boolean;
  },
): void {
  const document_ = leaving.ownerDocument;
  if (document_ === null) return;
  // On this control, inside it, or nowhere at all. The third is the case that needs the observation
  // above: the platform has already blurred a disabled element by the time some renderers hear about
  // it, and only a caller that looked before the change can say the keyboard was ever here.
  const active = document_.activeElement;
  const nowhere = active === null || active === document_.body;
  // Duck-typed rather than `instanceof Element`: this runs in whatever document a host gives it,
  // and a DOM implementation that does not put `Element` on the global object made the check throw
  // — inside an effect, which took the rest of the render down with it.
  const here = active === leaving || (isNode(active) && leaving.contains(active));
  if (!here && !(nowhere && options?.heldTheKeyboard === true)) return;

  const root = scope ?? document_.body;
  const order = Array.from(
    root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"),
  ).filter((candidate) => candidate.getAttribute("tabindex") !== "-1" && !leaving.contains(candidate) && candidate !== leaving);
  const at = order.findIndex((candidate) => leaving.compareDocumentPosition(candidate) & 4 /* FOLLOWING */);

  const tries: Element[] = [];
  if (at >= 0) tries.push(order[at]!);
  for (let index = order.length - 1; index >= 0; index -= 1) {
    if (at < 0 || index < at) { tries.push(order[index]!); break; }
  }
  const widget = leaving.closest("[class*=\"mdy-renderer\"]") ?? leaving.parentElement;
  if (widget !== null) tries.push(widget);

  for (const candidate of tries) {
    if (!isReachable(candidate)) continue;
    const target = candidate as HTMLElement;
    // A container is not in the tab order and does not need to be: it is somewhere to stand, so the
    // next Tab starts here rather than at the top of the document.
    if (!target.hasAttribute("tabindex") && !isNativelyFocusable(target)) target.tabIndex = -1;
    target.focus();
    if (document_.activeElement === target) return;
  }
}

/** Whether a value is a node this document can be asked about. */
function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null
    && typeof (value as { nodeType?: unknown }).nodeType === "number";
}

/** Whether an element takes focus without being given a `tabindex`. */
function isNativelyFocusable(element: Element): boolean {
  return ["button", "input", "select", "textarea", "a"].includes(element.tagName.toLowerCase());
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
  /**
   * Whether focus is currently borrowed.
   *
   * Distinct from holding a `previous`: a widget that opened while nothing was focused has still
   * borrowed focus and still owes a restore, and a widget that has already given it back owes
   * nothing — even though both hold `null`.
   */
  let borrowed = false;

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
      if (previous && (previous as HTMLElement).isConnected) {
        borrowed = true;
        return;
      }
      const active = documentOf()?.activeElement ?? null;
      previous = active && active !== documentOf()?.body ? active : null;
      borrowed = true;
    },

    restore(preferred?: Element | null): HTMLElement | null {
      // Nothing borrowed and nothing named: the widget has already given focus back, and falling
      // through to what is inside it would take focus into the widget it just handed it away from.
      if (!borrowed && !preferred) return null;
      const current = root();
      const chain = [preferred, previous, current ? firstFocusableWithin(current) : null];
      for (const candidate of chain) {
        if (candidate && takes(candidate)) {
          previous = null;
          borrowed = false;
          return candidate as HTMLElement;
        }
      }
      return null;
    },

    release(): void {
      // The borrow ends here, not only the reference. A released custodian owes nothing, so a
      // restore after it places no focus: a widget being torn down pulling focus into itself is the
      // same taking whichever route reaches it. A caller that wants focus placed says where with
      // `restore(preferred)`, which is honoured whether anything is borrowed or not.
      previous = null;
      borrowed = false;
    },
  };
}

/**
 * Puts the keyboard on an element that may not be showing yet, and checks that it took.
 *
 * A popup rendered into the top layer — a `popover`, a portalled panel — exists in the document a
 * frame before it is shown, and `focus()` on an element that is not being rendered is a no-op that
 * reports nothing. A renderer that focuses on the render it triggered therefore leaves the keyboard
 * where it was, and the arrows it just enabled have nothing to move.
 *
 * So the attempt is verified rather than assumed, and tried again on the next frame while `still`
 * holds — bounded, because a panel that never draws is a different defect and a retry that never
 * stops would hide it.
 *
 * `schedule` is the caller's frame: a renderer that already has one — a scheduler, an update
 * promise — passes it rather than growing a second clock.
 */
export function focusWhenShown(
  target: () => Element | null | undefined,
  options: {
    readonly attempts?: number;
    readonly still?: () => boolean;
    readonly schedule?: (run: () => void) => void;
  } = {},
): void {
  const attempts = options.attempts ?? 3;
  const later = options.schedule
    ?? ((run: () => void) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else queueMicrotask(run);
    });
  const attempt = (left: number): void => {
    if (options.still !== undefined && !options.still()) return;
    const element = target();
    if (element === null || element === undefined) {
      if (left > 0) later(() => attempt(left - 1));
      return;
    }
    (element as HTMLElement).focus?.();
    if (element.ownerDocument?.activeElement === element) return;
    if (left > 0) later(() => attempt(left - 1));
  };
  attempt(attempts);
}
