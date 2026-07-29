---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

The chip is a contract, and the multiselect wears Angular's anatomy

Every renderer spelled its own chip: `"mdy-chip mdy-chip--counter"` in one, a ternary for
`--selected` in another. `MDY_CHIP_CLASSES` names the primitive and its variants, and
`multiselectChipClasses({ mode, role, selected })` answers what a chip carries — the mode picks the
variant, selection is a state on top of it, never a variant of its own. Angular, Lit and the
framework-free renderer all ask it, so the foundation's `.mdy-chip--selected` is the only place that
decides what a taken chip looks like.

The multiselect's anatomy is now Angular's, which is the reference: the options are chips in a grid
*in the field*, under a header whose search button opens a popup holding the same grid over a filter
box. `options`, `header` and `optionWrapper` are named; the popup's grid carries the shared class
plus the overlay one, so one rule lays out both. A compact trigger showing value chips stays
declared and optional.

Found while checking it in a browser: the foundation read `--mdy-sys-*` and `--mdy-ref-*` without
fallbacks, so in the default and Material themes a chip had no border and no corners —
`border: 1px solid var(--mdy-sys-color-outline)` is dropped entirely when that token is absent. All
155 now resolve to the tier's own values, and the audit covers the system and reference tiers too.
