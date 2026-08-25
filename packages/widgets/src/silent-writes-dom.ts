/**
 * Values written into a control by something that never says so, and how the model comes to hear.
 *
 * A browser writes into a person's form without asking this library first, and does it on paths that
 * matter: **session history restoration** hands their typing back when they press Back, and
 * **autofill** puts an address or a card into fields the person never touched. Both write the value
 * property directly. Neither is a mistake — they are the platform doing what a person expects.
 *
 * What is a mistake is a form that does not notice. Measured, one field with an initial value of
 * `Ada`, typed `Grace`, away and Back again:
 *
 *     chromium   the box showed "Grace"   the model held "Ada"    they disagree, silently
 *     firefox    the box showed "Ada"     the model held "Ada"    agreed, and the typing is gone
 *     webkit     the same
 *
 * The first is the state to fear, and the reason is not that a value was lost. It is that **what is
 * presented for review is not what will be sent.** A person reads the field, presses submit, and
 * something else goes; there is no moment at which they could have noticed, because every part of
 * the page is individually correct. Losing the typing is a loss they can see and redo.
 *
 * ## Two moments, one rule
 *
 * The rule is that the model and the boxes never disagree about what will be submitted. It is
 * enforced at the only two moments where a silent write can be caught:
 *
 * - **As the controls are built**, when the page was reached by going back or forward. The restore
 *   lands around then, and it lands without an `input` or a `change` — measured in all three
 *   engines. There is nothing to listen to; a form has to look.
 * - **At the submit**, before anything reads the value. Whatever wrote into a control between the
 *   last thing this library heard and now — autofill, a password manager, an extension — is adopted
 *   there, so the value that leaves is the value that was on screen.
 *
 * ## Which controls moved is answered by difference
 *
 * Nothing reports what was written or by whom. So every control's value is remembered, refreshed on
 * each `input` and `change` that passes, and compared at those two moments. A control whose value
 * differs from the last one this library heard about was written to by somebody else.
 *
 * Adoption is an `input` and a `change` on that control — the door a person's own typing comes
 * through. The model hears it the way it hears everything else, and no part of this needs to know
 * what a kind is or how it stores its value.
 */

/** A binding over a document that has no window. There is one of it, and it does nothing. */
const NOTHING_TO_WATCH = (): void => undefined;

/** What guarding a form needs from its host: where to look, and how to wait for the browser. */
export interface MdySilentWriteBinding {
  /** The element containing the controls to watch. Its own descendants, and it, are examined. */
  readonly root: Element;
  /**
   * How to run the comparison that follows a history restore, after the browser has finished it.
   *
   * The default is a task. Given rather than assumed so a test can drive it, and so a renderer that
   * batches its writes can place the comparison after its own.
   */
  readonly schedule?: (run: () => void) => void;
  /**
   * How the navigation that led here is reported, for a host that knows better than the timing API —
   * a router restoring a view, for instance, where the document was never renavigated.
   *
   * Defaults to the browser's own answer. Anything other than `"back_forward"` means there was no
   * restore, and only the submit guard remains.
   */
  readonly navigation?: () => string | undefined;
}

/**
 * The controls something can write into, and the property each one carries its value in.
 *
 * Read by tag rather than by `instanceof`: a constructor belongs to the window it came from, and a
 * control inside an iframe — or, in a test, inside a document the global scope knows nothing about —
 * fails an `instanceof` against the ambient one while being exactly the element in question.
 */
const VALUE_OF = (el: Element): string | null => {
  const control = el as Element & { value?: unknown; checked?: boolean; type?: string };
  switch (el.tagName) {
    case "INPUT":
      return control.type === "checkbox" || control.type === "radio"
        ? String(control.checked)
        : String(control.value ?? "");
    case "TEXTAREA":
    case "SELECT":
      return String(control.value ?? "");
    default:
      return null;
  }
};

const controls = (root: Element): Element[] =>
  [root, ...Array.from(root.querySelectorAll("input, textarea, select"))]
    .filter((el) => VALUE_OF(el) !== null);

const navigationType = (root: Element): string | undefined => {
  const timing = root.ownerDocument.defaultView?.performance?.getEntriesByType?.("navigation")?.[0];
  return (timing as { type?: string } | undefined)?.type;
};

/**
 * Watches a form for values written into it by something other than this library, and tells the
 * model about them. Returns the function that stops watching.
 *
 * Called as the controls are built. The submit guard runs for the life of the binding; the restore
 * comparison happens once, and only when the page was reached by going back or forward.
 */
export function adoptSilentWrites(binding: MdySilentWriteBinding): () => void {
  const { root } = binding;
  const document = root.ownerDocument;
  const view = document.defaultView;
  // No window: nothing can write into these controls, and nothing can be dispatched at them.
  if (view === null) return NOTHING_TO_WATCH;

  /** The last value this library heard about, per control. Anything else is somebody else's write. */
  const heard = new Map<Element, string>();
  const remember = (): void => { for (const el of controls(root)) heard.set(el, VALUE_OF(el) as string); };
  remember();

  const adopt = (): void => {
    for (const el of controls(root)) {
      const was = heard.get(el);
      const now = VALUE_OF(el) as string;
      // A control this library has never seen is new, not written to: remember it and say nothing,
      // or every field added after the binding would be reported as somebody else's input.
      if (was === undefined || was === now) { heard.set(el, now); continue; }
      heard.set(el, now);
      el.dispatchEvent(new view.Event("input", { bubbles: true }));
      el.dispatchEvent(new view.Event("change", { bubbles: true }));
    }
  };

  // Every value that arrives the ordinary way, so that only what did not is left over. Capture, and
  // on the root rather than the document, so a form does not account for its neighbour's controls.
  const onHeard = (event: Event): void => {
    const el = event.target;
    if (el instanceof view.Element && VALUE_OF(el) !== null) heard.set(el, VALUE_OF(el) as string);
  };
  root.addEventListener("input", onHeard, true);
  root.addEventListener("change", onHeard, true);

  /**
   * The submit, caught on the document on the way down.
   *
   * First, deliberately: everything else that reads the value — the renderer's own handler, the
   * consumer's, a validator — runs after this, so what they read is what was on screen.
   */
  const onSubmit = (event: Event): void => {
    const form = event.target;
    if (!(form instanceof view.HTMLFormElement) || !form.contains(root)) return;
    adopt();
  };
  document.addEventListener("submit", onSubmit, true);

  let cancelled = false;
  const navigation = binding.navigation ?? (() => navigationType(root));
  if (navigation() === "back_forward") {
    const schedule = binding.schedule ?? ((run: () => void) => { setTimeout(run, 0); });
    schedule(() => { if (!cancelled) adopt(); });
  }

  return () => {
    cancelled = true;
    root.removeEventListener("input", onHeard, true);
    root.removeEventListener("change", onHeard, true);
    document.removeEventListener("submit", onSubmit, true);
  };
}
