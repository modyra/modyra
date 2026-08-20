/**
 * The radius the clock's outer digits are drawn at, read from the stylesheet that draws them.
 *
 * `--tp-hand-length` is `dialSize / 2 − numSize / 2 − 8px`, and all three of those numbers belong to
 * the drawing. Measured rather than recomputed in TypeScript: a copy of them here is a copy that
 * drifts from the paint, and a hit test that disagrees with the drawing sends a pointer to the
 * number beside the one under the finger.
 *
 * Falls back to the face's own radius when no stylesheet is loaded — a face with nothing drawn on it
 * has no rings for the answer to be wrong about.
 */
export function handLengthOf(face: Element, rect: { readonly width: number }): number {
  const declared = getComputedStyle(face).getPropertyValue("--tp-hand-length").trim();
  const measured = Number.parseFloat(declared);
  return Number.isFinite(measured) && measured > 0 ? measured : rect.width / 2;
}
