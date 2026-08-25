/**
 * The reset a `<form>` performs, reaching the values the form actually holds.
 *
 * A consumer puts these controls inside a `<form>` with a button that says Cancel. That button is
 * `type="reset"`, it is elementary HTML, and until this existed each renderer answered it differently
 * and none answered it correctly:
 *
 *     plain     the box showed ""       the model held "Grace"     seen empty, sent "Grace"
 *     lit       the box showed ""       the model held "Grace"     the same
 *     angular   the box showed "Grace"  the model held "Grace"     agreed, and Cancel did nothing
 *
 * The first two are the worse failure by a distance: **what a person sees stops being what the form
 * sends**, and they press Cancel, watch the field empty, and submit the value they believed they had
 * discarded. The browser's own reset sets an input back to its `value` *attribute*, which these
 * renderers never write — they set the property — so the box empties and the model does not hear
 * about it.
 *
 * None of the three returned to the initial value, which is what a reset means: HTML restores what
 * the document declared, and a form library that holds the value owes the same answer.
 *
 * **Watched from the document, and answered after the browser has finished.** The listener sits on
 * the document in the capture phase and asks, at the moment of the event, whether the form being
 * reset contains this element. Which form that is may change after binding — an element mounted on
 * its own and moved into a form later is a form's control from then on, and a listener attached to
 * whatever form existed at bind time would never hear about it.
 *
 * The write is deferred by a task because the browser resets each control *after* dispatching the
 * event: a model written during the event is overwritten by the boxes a moment later.
 */

/** What a bound reset needs from its host: where it lives, and how to return to the beginning. */
export interface MdyFormResetBinding {
  /**
   * The element whose enclosing form is the one being watched, or that form itself.
   *
   * Read at each reset rather than at bind time, so an element that changes form — or acquires one —
   * is answered by the form it is in now.
   */
  readonly element: Element;
  /** Return the values to what the document declared, which is what a reset means. */
  readonly reset: () => void;
  /**
   * How to run the write after the browser has finished its own.
   *
   * Given rather than assumed: a renderer that batches its own writes wants its own scheduler here,
   * and a test wants one it can flush. The default is a task, which is after the browser's reset and
   * before the next paint.
   */
  readonly schedule?: (run: () => void) => void;
}

/**
 * Binds a form's reset to the model, and returns the function that unbinds it.
 *
 * Binding does not require the element to be in a form yet: nothing is resolved until a reset
 * happens, so a control mounted on its own and placed into a form afterwards is answered from then
 * on, and one that is never in a form is never called.
 */
export function bindFormReset(binding: MdyFormResetBinding): () => void {
  const root = binding.element.ownerDocument;
  const schedule = binding.schedule ?? ((run: () => void) => { setTimeout(run, 0); });

  const onReset = (event: Event): void => {
    const form = event.target;
    // `contains` reports an element as containing itself, which is what lets a renderer that owns
    // the form pass the form here rather than hunting for a control inside it.
    if (!(form instanceof root.defaultView!.HTMLFormElement) || !form.contains(binding.element)) return;
    schedule(() => { binding.reset(); });
  };

  // Capture, because `reset` is dispatched at the form and a document-level listener has to see it
  // on the way down to be independent of whether it bubbles.
  root.addEventListener("reset", onReset, true);
  return () => { root.removeEventListener("reset", onReset, true); };
}
