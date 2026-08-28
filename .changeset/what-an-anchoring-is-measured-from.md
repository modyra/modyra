---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The three readings an anchoring decision is made from, taken once

`anchorOverlay` has always declared what it needs — a viewport, a direction, a content size — and
never how to obtain them, so each renderer gathered them itself. The three gatherings were
**character-for-character identical**: one answer written in the three places somebody had to write
it.

`viewportSize`, `inlineDirectionOf` and `measureOverlayContent` are exported. They stay outside
`anchorOverlay` because that function is pure and is exercised against rectangles no document ever
held — what is shared is the *reading*, not the decision.

Each carries a trap, which is why none of them was a one-liner:

- **the border box.** `scrollHeight` stops at the padding edge, so a popup with a border asks for a
  size its own outline does not fit in, and every decision made from it clamps a few pixels short;
- **nothing laid out.** Zero is not a measurement, and a decision made from zero is indistinguishable
  from one made on a real one, so it answers `null`;
- **the live direction.** A widget declares which *inline* edge its popup hangs from; only the
  document says which physical edge that is today.

The shared measurement is the **union** of what the three guarded, not the smallest of them: one
checked `hidden`, one checked null, one checked neither. Narrowing to any single renderer's guard
would have taken something away from the other two.
