/**
 * The radius the clock's outer digits are drawn at.
 *
 * The rule is `@modyra/widgets`' — measuring it went wrong twice, and both times the same line was in
 * three renderers. This keeps the local signature the call sites use and answers with the contract's.
 */
import { dialHandLength } from "@modyra/widgets";

export function handLengthOf(face: Element, rect: { readonly width: number }): number {
  const measured = dialHandLength(face);
  return Number.isFinite(measured) && measured > 0 ? measured : rect.width / 2;
}
