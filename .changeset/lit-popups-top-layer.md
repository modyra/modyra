---
"@modyra/lit": patch
"@modyra/widgets": minor
"@modyra/plain": patch
---

Lit's popups join the top layer, and one function puts every adapter's there

Lit was the last adapter still laying its popups out in the page. That is not a detail of how a
popup looks: the coordinates every adapter writes are viewport coordinates, and `position: fixed`
only means that while no ancestor is a containing block for fixed descendants. `container-type` —
which the foundation needs so a row can ask how wide its *form* is rather than how wide the window
is — makes every ancestor of every field exactly that. A Lit popup was therefore anchored against
whichever ancestor happened to win, and clipped by any `overflow: hidden` above it.

`setOverlayOpen` moves from `@modyra/plain` to `@modyra/widgets`, where the rest of the anchoring
contract lives, and both adapters now call it. Plain re-exports it so its fields keep one import for
everything overlay. Two adapters calling one function is a contract; two adapters with one copy each
is a drift waiting to happen — and this one carries a policy decision worth stating once, namely
`popover="manual"` rather than `auto`, because light dismissal would close a popup before the
adapter's own outside-pointer handling ran.

The controller shows it once per popup rather than once per frame — `refresh` runs on every scroll
frame and `showPopover` throws on an element already showing — and takes it out of the top layer
explicitly on close, rather than relying on the element being removed, so a renderer that keeps its
popup in the DOM does not leave a closed one showing.

Every Lit widget with a popup is covered: jsdom has no top layer, so the assertion is that the popup
reaches the one function that puts it there, wearing the `manual` policy that function applies.
