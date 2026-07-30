---
"@modyra/angular": patch
"@modyra/styles": patch
---

The colour palette is placed by the contract, and three stylesheets stop placing it

The `material-positions-colors-popup` debt, closed — and its cause was not in the themes.

**Angular's palette was the one popup in the catalog not wearing `mdy-popup`.** The catalog declares
`partClasses("colors", "popup") === ["mdy-colors__dropdown", "mdy-popup"]`; the framework-free
renderer applies it, Lit derives it, and the Angular renderer spelled a single class by hand. The
foundation therefore could not place it — so the foundation, Material and iOS each carried a copy of
the popup primitive for this one widget: position and insets, `display` for open and closed, and
their own `--above` and `--overlay` rules re-deriving the placement class names
`popupPlacementClass` already produces. The theme rules were the consequence; the missing class was
the cause.

The palette now wears `mdy-popup mdy-overlay` and the three copies are gone. What the stylesheets
still say is what a palette looks like — and no longer where it goes.

Two things measurement decided rather than reasoning:

- **`mdy-popup` alone put it off-screen at `x: -928`.** A popup inside an overlay panel is not itself
  the popover, so it stays `position: absolute` and resolves its insets against whatever is
  positioned above it. `mdy-overlay` is the portal variant that means viewport coordinates — which
  is exactly why the framework-free renderer has carried both all along.
- **A widget cannot state its own surface in an earlier layer than the primitive it opted into.** The
  palette's background and its roomier padding sat in `mdy.base`, and `.mdy-popup` is in
  `mdy.components`; the palette lost both the moment it joined. Restating them as
  `--mdy-overlay-padding` and `--mdy-overlay-surface-color` fixes it wherever the primitive's own
  declarations win — and where a theme declares `padding` on `.mdy-popup` outright, as
  `modyra-modern.css` does, the theme has to say it for the palette too. It now does.

Measured across all four stylesheets after the change: `position: fixed`, drawn, inside the viewport,
below its control, each with its own surface and its 20–24px of padding. The new demo test asserts
exactly that, per theme, and fails against the previous code.

Two findings recorded rather than fixed: `modyra-material.css` collapses the palette's trigger to
zero height, and every popup in `modyra-modern.css` re-declares what the overlay properties exist to
carry.
