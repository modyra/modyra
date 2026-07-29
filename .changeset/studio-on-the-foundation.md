---
"@modyra/studio-ui": minor
---

Studio's canvas draws on Modyra's foundation

The canvas renders Modyra controls, but Studio never loaded `@modyra/styles` — so it restated the
contract's own rules, re-implementing `.mdy-layout-columns` as a grid of its own reading
`--mdy-layout-column-count`. Two pictures of the same layout, free to drift.

`apps/studio` now depends on `@modyra/styles` and imports the foundation before Studio's chrome, so
the layout grid, the field height, the popup container and the chip primitive are the contract's.
Studio's rule keeps only what is Studio's: the spacing between the tracks.

Verified with Studio's own end-to-end suite — the layout, canvas and preview specs pass with the
grid deduped, and the run is identical to the one before the change.
