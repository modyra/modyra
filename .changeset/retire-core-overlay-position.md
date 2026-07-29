---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/lit": patch
---

Overlay placement is one vocabulary, and it lives in `@modyra/widgets`

`@modyra/core/overlay-position` held the placement policy Modyra had before there was a contract. Its
functions have been unused by every renderer since `anchorOverlay` took over — but its *types* were
still the currency Angular and Lit spoke, so the package that no longer decides where a popup goes
was still the package that said what "where" means.

`@modyra/widgets` now names it: `MdyOverlayPlacement`, `MdyOverlayAlignment`, `MdyOverlayCoords`,
`MdyOverlayPlacementResult`, and `overlayStyleProperties` for a host that positions its panel from the
custom properties. Angular and Lit import from there; nothing in the repository imports
`@modyra/core/overlay-position` any more.

**For consumers of `@modyra/core`:** nothing is removed. Every export in that module stays, and each
now carries `@deprecated` naming its replacement. The types are duplicated rather than re-exported
because `@modyra/widgets` depends on `@modyra/core`, and re-exporting would make the two packages
depend on each other; they are structurally identical, so imports can move across one at a time.

Worth knowing before you move: `computeOverlayPosition` never knew how big the popup was. It picked a
side with *enough* room rather than the side where the content fits, and could not report whether the
popup would scroll. `anchorOverlay` takes the measured content and answers both.
