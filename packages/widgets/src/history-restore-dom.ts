/**
 * What the browser hands back when somebody presses Back, and how a form comes to agree with it.
 *
 * Session history restoration is the platform giving a person the text they had typed. It is
 * deliberate behaviour, not a quirk, and it reaches a control this library built — but nothing tells
 * the model about it, so the two drift apart:
 *
 *     one field, initial "Ada", typed "Grace", away and Back again
 *
 *     chromium   the box showed "Grace"   the model held "Ada"    they disagree, silently
 *     firefox    the box showed "Ada"     the model held "Ada"    agreed, and the typing is gone
 *     webkit     the same
 *
 * The first is the state to fear. A person is shown a value, presses submit, and something else is
 * sent — and there is no moment at which they could have noticed, because every part of the page is
 * individually correct. Losing the typing is a loss they can see; this is a loss they cannot.
 *
 * The restore happens in all three. What differs is *when*, relative to the controls being built:
 * Chromium restores after, and reaches controls created by script; the other two restore before they
 * exist. So there is nothing to adopt where nothing was restored, and nothing to disagree about
 * either.
 *
 * **The restore is silent.** It fires no `input` and no `change` — measured in all three. A form
 * cannot be told; it has to look.
 *
 * **Which controls moved is answered by difference, not by asking.** No API reports what was
 * restored. A snapshot taken as the controls are built, compared a task later, names exactly the
 * ones something else wrote to.
 */

/** Nothing to adopt: the page was not reached by going back. Shared, because there is one of it. */
const NOTHING_TO_ADOPT = (): void => undefined;

/** What adopting a restore needs from its host: where to look, and how to wait for the browser. */
export interface MdyHistoryRestoreBinding {
  /** The element containing the controls to reconcile. Its own descendants, and it, are examined. */
  readonly root: Element;
  /**
   * How to run the comparison after the browser has finished restoring.
   *
   * The default is a task. Given rather than assumed so a test can drive it, and so a renderer that
   * batches its writes can place the comparison after its own.
   */
  readonly schedule?: (run: () => void) => void;
  /**
   * How the navigation that led here is reported, for a host that knows better than the timing API —
   * a router restoring a view, for instance, where the document was never renavigated.
   *
   * Defaults to the browser's own answer. Anything other than `"back_forward"` means there is no
   * restore to adopt and nothing happens at all.
   */
  readonly navigation?: () => string | undefined;
}

/**
 * The controls a browser restores, and the property each one carries its value in.
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
  [root, ...root.querySelectorAll("input, textarea, select")].filter((el) => VALUE_OF(el) !== null);

const navigationType = (root: Element): string | undefined => {
  const timing = root.ownerDocument.defaultView?.performance?.getEntriesByType?.("navigation")?.[0];
  return (timing as { type?: string } | undefined)?.type;
};

/**
 * Adopts what the browser restored into the model, and returns the function that cancels the pending
 * comparison.
 *
 * Called as the controls are built. Does nothing at all unless the page was reached by going back or
 * forward, so the ordinary mount pays one string comparison and stops.
 *
 * Adoption is an `input` and a `change` on each control that moved — the door a person's own typing
 * comes through. The model hears about it the way it hears about everything else, and the field is
 * marked touched, which it was: they had typed there before they navigated away.
 */
export function adoptHistoryRestore(binding: MdyHistoryRestoreBinding): () => void {
  const navigation = binding.navigation ?? (() => navigationType(binding.root));
  if (navigation() !== "back_forward") return NOTHING_TO_ADOPT;

  const before = new Map(controls(binding.root).map((el) => [el, VALUE_OF(el)]));
  let cancelled = false;

  const compare = (): void => {
    if (cancelled) return;
    const view = binding.root.ownerDocument.defaultView;
    if (view === null) return;
    for (const [el, was] of before) {
      // Only what changed without this library changing it. A control the renderer itself wrote to
      // between the snapshot and the comparison is not a restore, and telling the model about it
      // would report the model's own value back to it as a person's input.
      if (!el.isConnected || VALUE_OF(el) === was) continue;
      el.dispatchEvent(new view.Event("input", { bubbles: true }));
      el.dispatchEvent(new view.Event("change", { bubbles: true }));
    }
  };

  const schedule = binding.schedule ?? ((run: () => void) => { setTimeout(run, 0); });
  schedule(compare);
  return () => { cancelled = true; };
}
