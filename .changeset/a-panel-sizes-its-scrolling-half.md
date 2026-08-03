---
"@modyra/styles": patch
---

The multiselect popover shows its contents in Safari.

`.mdy-multiselect-overlay__grid` sized itself with `max-height: 100%`. Its parent states a
`max-height` and no `height`, so the parent's height is **indefinite**, and a percentage against an
indefinite containing block is undefined territory: one engine resolves it to `none`, another to
zero. On Safari the grid collapsed and the panel showed the search box with nothing under it —
exactly as if the panel had no minimum height.

Expressed as flex instead: `flex: 1 1 auto` takes the space the search box does not, and
`min-height: 0` is what lets it actually scroll — a flex item's default `min-height: auto` refuses
to shrink below its content, so an `overflow-y: auto` item grows past the max-height it was given
rather than scrolling inside it.

A side effect worth naming: an *empty* popover now hugs its content instead of stretching to the
height the placement policy allowed it. That is the same rule doing its job, not a second change.

Reported from real Safari. Playwright's WebKit does not reproduce it — it resolves the percentage
the way Chromium does — so nothing in the browser suite would have caught this, on any of the three
engines it now runs.
