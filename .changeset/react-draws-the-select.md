---
"@modyra/react": minor
"@modyra/vue": patch
"@modyra/widgets": minor
---

`@modyra/react` draws the select, in both of the shapes the contract gives it, and gains the two
hooks every overlay kind after it needs.

**The panel is placed, and it dismisses.** `useMdyAnchoredPanel` measures the trigger and the
viewport, hands both to `anchorOverlay`, and writes back what comes out; `useMdyLightDismiss` closes
the panel when a pointer interaction finishes outside it. Neither decides anything: which side a
panel prefers, how much room it needs before it flips, and what counts as "outside" are the
contract's answers, reached through its own doors. "Outside" in particular is not `contains` on the
field — the panel is drawn in the body (ADR 0130), so a rule written that way would dismiss on every
click a person makes in the panel they are using.

**Both shapes of select.** `variantOf` answers `native` for a select that does not filter, and that
is the platform's chooser: no popup, no landing place for focus, and no `aria-expanded`,
`aria-controls` or `aria-haspopup`, which would describe a combobox that is not there. The filtering
shape is the combobox this package draws, with the panel outside the field.

**A command that names a part needs a host that can find it.** `useMdySelectField` now takes an
optional element lookup. Without one, "close and put the person back on the trigger" resolved to
nothing: Escape shut the panel and left focus on an element that had just been removed. The eight
other widget hooks still take none — they gain it as their components land.

**`@modyra/widgets` gains `applyAnchoredOverlay`.** Placing an overlay ends in four writes — the
coordinates, the placement as data, the stale placement classes off, the new ones on — and the third
is the one that goes missing when the block is written per renderer: nothing looks wrong until a
panel flips, and then it wears two answers about where it is. React and Vue now share the door;
`@modyra/vue`'s copy of it is gone.

Its placement vocabulary is a total record rather than a list, so a placement added to the contract
fails to compile here instead of quietly never being cleared.
