/**
 * The radius the clock's outer digits are drawn at, read from the element that is drawn there.
 *
 * `--tp-hand-length` is `dialSize / 2 − numSize / 2 − 8px`, and all three of those numbers belong to
 * the drawing. Measured rather than recomputed in TypeScript: a copy of them here is a copy that
 * drifts from the paint, and a hit test that disagrees with the drawing sends a pointer to the
 * number beside the one under the finger.
 *
 * **The hand's own height, not the property.** A custom property resolves at use, so
 * `getComputedStyle(face).getPropertyValue("--tp-hand-length")` answers with the token stream —
 * `calc(256px/2 - 40px/2 - 8px)` — which no `parseFloat` reads. That branch never succeeded, and
 * what actually ran was the fallback: half the *face*, which is 128 where the hand is 100. Every
 * angle-at-a-radius in this widget was computed against a circle 28% too large, silently, because a
 * plausible number came back either way.
 *
 * Falls back to the face's own radius when there is no hand to measure — a face with nothing drawn on
 * it has no rings for the answer to be wrong about.
 */
export function handLengthOf(face: Element, rect: { readonly width: number }): number {
  const hand = face.querySelector(".mdy-timepicker-dial__hand");
  const drawn = hand ? Number.parseFloat(getComputedStyle(hand).height) : Number.NaN;
  return Number.isFinite(drawn) && drawn > 0 ? drawn : rect.width / 2;
}
