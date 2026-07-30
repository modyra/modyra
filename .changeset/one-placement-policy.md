---
"@modyra/lit": patch
"@modyra/widgets": patch
---

One placement policy: a popup that moves rather than one that shrinks

Reported as a preference for how Angular's overlays behave while the page scrolls. Measured, the
adapters were not doing the same thing at all — they reached `anchorOverlay` through two different
doors, and the two are different policies:

- `current` — plain and Angular. The coordinates follow the anchor; the *shape* is the decision
  taken when it opened, and the side changes only once it has genuinely stopped fitting.
- `lock` — Lit. The side it opened on is pinned and the **height is re-measured every frame**, so a
  popup scrolling towards the bottom of the window shrinks and its content goes behind a scrollbar.

Lit now passes `current`, unconditionally. It used to pass `lock` only when the caller supplied both
`lockPosition` and `lockAlignment`, so it sometimes stabilised nothing at all. Its panel state
carries the whole decision rather than just the side and the edge it landed on: the height is the
part that was being re-measured, and holding a decision means holding all of it.

`lock` remains, documented as what it is — pin the corner, let the box shrink — and no adapter uses
it. The difference between the two is now asserted rather than left to be discovered: at the same
scroll position, on the same popup, `current` keeps 452px and `lock` cuts it to 188px.

`stabilizeOverlayPlacement` is the pivot of all of this and had only ever been reached through
`anchorOverlay`, so three of the facts its docstring claims had no test: the shape is held while
`fits` is reported against the room of *this* frame; a modal popup is not un-modalled by room
appearing around an anchor it stopped chasing; the width, alone, still follows the anchor. Each is a
separate branch and each now has one.

The Lit tests assert this from the adapter's own state, because "all three adapters agree" is a
claim about three call sites, and a test of the shared function cannot make it.
