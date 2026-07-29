---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/styles": minor
---

A popup says which side it landed on, in the one name the contract gives it

The catalog has declared `above` and `overlay` as states of every popup part for some time. No
renderer used them. Angular and Lit each spelled the same idea as `mdy-overlay-panel--above` /
`--overlay` on a wrapper element — a name the catalog never gave and no stylesheet has ever
matched — and `@modyra/plain` wrote `data-placement` instead. One decision, three spellings, none of
them styled.

The cost was not theoretical. The foundation carried a rule that reversed a multiselect's popup when
it opened upwards, so the filter box sits nearest the control the user just clicked. It was keyed on
the overlay panel's `--above`, which nothing emits, so **an upward-opening multiselect has always put
its filter at the top, furthest from the pointer.** Coordinates cannot express that: `top` and `left`
put the box somewhere, they cannot tell a stylesheet which way it went.

`overlayAnchoringFor(kind)` now carries the `kind` it was asked about. `anchorOverlay` does not read
it — placement is geometry — but a renderer holding an anchoring now holds everything needed to name
the result, so `@modyra/plain` reflects the placement through `partClasses(kind, "popup", …)` with no
change at any call site. `below` carries no class, exactly as the catalog documents, so an ordinary
popup is spelled like one nobody has placed.

`MdyPopupWidgetKind` is derived from the catalog — the kinds whose contract declares a `popup` part.
Asking `partClasses` for a checkbox's popup now fails to compile rather than at runtime, and a widget
that gains or loses a popup changes the type by changing its own definition. A test asserts anchoring
and a popup part always travel together, since `overlayAnchoringFor` reports the narrowed kind on the
strength of the anchoring guard alone.

The foundation's reversal rule is re-keyed onto the contract's name and applies for the first time.

**Angular and Lit still emit `mdy-overlay-panel--*` as of this changeset.** They are unchanged here
and no worse than before — the class was unstyled then and is unstyled now. Moving them onto the
contract needs the panel to learn which widget it is holding, which is renderer plumbing rather than
a stylesheet change; the batches that follow do it, and by release no adapter emits those names.
