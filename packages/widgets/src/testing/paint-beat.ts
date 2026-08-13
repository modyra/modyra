/**
 * When a renderer's DOM catches up with a write, declared rather than guessed.
 *
 * Every suite that drives a widget has to wait before it looks, and every fixture picked its own
 * number: twenty milliseconds here, twenty and an `updateComplete` there, a synchronous call
 * somewhere else. A number that is too small reads every state as its previous value, which is
 * indistinguishable from a renderer that ignored the change — so a fixture that guesses low reports
 * the renderer for the fixture's mistake, and one that guesses high hides a renderer that is slow to
 * settle behind a wait nobody chose deliberately.
 *
 * The beat is a property of the renderer, so the renderer says which one it has. What the suite does
 * about it is derived from that, once.
 */

/**
 * How a renderer's rendering becomes visible after a value changes.
 *
 * The tuple type is written out rather than inferred: an annotation is emitted verbatim, so the
 * declaration file does not depend on any compiler's printing of an inferred tuple.
 */
export const MDY_PAINT_BEATS: readonly ["synchronous", "microtask", "task", "host"] = [
  /** The write renders when the host is asked to render: a flush, and nothing pending after it. */
  "synchronous",
  /** The host flushes on the microtask queue. */
  "microtask",
  /** The host schedules onto a task — a signal write is not visible until the turn ends. */
  "task",
  /** The host publishes its own promise for "I have finished rendering". */
  "host",
] as const;

export type MdyPaintBeat = (typeof MDY_PAINT_BEATS)[number];

/**
 * The wait a beat implies.
 *
 * `host` needs the renderer's own promise, because only the host knows when it is done; the others
 * are properties of the platform and are the same wherever they appear. A `host` beat without a
 * flush is a fixture claiming a guarantee it did not supply, and is refused rather than silently
 * treated as a task.
 */
export function settleFor(
  beat: MdyPaintBeat,
  hostFlush?: () => Promise<unknown> | unknown,
): () => Promise<void> {
  switch (beat) {
    case "synchronous":
      // A renderer that paints when it is told still has to be told. The flush is the telling, not
      // a wait: nothing is pending afterwards, which is what makes this beat different from `host`.
      return async () => { await hostFlush?.(); };
    case "microtask":
      return async () => { await Promise.resolve(); };
    case "task":
      return async () => { await new Promise<void>((resolve) => { setTimeout(resolve, 0); }); };
    case "host":
      if (!hostFlush) {
        throw new Error('[modyra] a "host" paint beat must supply the host\'s own flush');
      }
      return async () => {
        await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
        await hostFlush();
      };
  }
}
