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
 * **Capture phase, and the model moves after the browser has finished.** `reset` does not bubble from
 * the form, so a listener has to be on the form itself; and the browser's own resetting of each
 * control happens after the event is dispatched, so a model written during the event would be
 * overwritten by the box a moment later. The write is deferred by a task for that reason, not for
 * timing comfort.
 */

/** What a bound reset needs from its host: where it lives, and how to return to the beginning. */
export interface MdyFormResetBinding {
  /** Any element inside the form. The nearest `<form>` ancestor is what gets listened to. */
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

/** Unbinding something that was never bound. Shared: there is one of it, and it does nothing. */
const NOTHING_BOUND = (): void => undefined;

/**
 * Binds a form's reset to the model, and returns the function that unbinds it.
 *
 * Returns a no-op when the element is not inside a form: a control mounted on its own has no reset
 * to answer, which is the ordinary case rather than a misconfiguration.
 */
export function bindFormReset(binding: MdyFormResetBinding): () => void {
  const form = binding.element.closest("form");
  if (form === null) return NOTHING_BOUND;

  const schedule = binding.schedule ?? ((run: () => void) => { setTimeout(run, 0); });
  const onReset = (): void => { schedule(() => { binding.reset(); }); };

  form.addEventListener("reset", onReset);
  return () => { form.removeEventListener("reset", onReset); };
}
