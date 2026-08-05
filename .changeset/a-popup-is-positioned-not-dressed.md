---
"@modyra/widgets": minor
"@modyra/styles": minor
"@modyra/angular": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

A popup is positioned, not dressed.

`.mdy-popup` positioned a popup **and** painted it. A container that paints is a wrapper around the
thing it was meant to present: a material applied to the content sits on an opaque panel rather than
on the page, which is a translucent effect with nothing to be translucent against.

The primitive now keeps position, insets, clipping and the open/close transition. **`mdy-popup--surface`**
takes background, border, elevation and padding, and the catalogue emits both on every `popup` part —
so nothing changes by default, and a theme whose popup *is* its content neutralises one class without
touching the coordinates. The radius stays on both: on the primitive it is what `overflow` clips to.

**`capabilities.overlayScrolls`** — `true` for `select` and `multiselect`, `false` for the four
pickers. A popup whose content does not scroll and which **no placement holds entirely** — neither
side vertically, neither edge horizontally — now centres instead of being clamped. A 256px clock face
with 200px below it was called a fit, docked, and turned into something you scroll a clock in; it is
centred and whole. A modal placement of non-scrolling content gets the viewport rather than 70% of
it, since that framing reintroduces the same stub one step in.

**`trackAnchoredOverlay`** follows the page in one place, `{ capture: true, passive: true }` and
coalesced to one reposition per frame. The framework-free renderer repositioned synchronously on every
scroll event, non-passive and uncoalesced — a measure-and-write far more often than frames, which is
both the cost and the judder.

Migration: a host that styled `.mdy-popup` expecting a surface should style `.mdy-popup--surface`. A
renderer that hardcodes popup classes rather than deriving them from the contract must add the new
one — Angular did, in six templates.
