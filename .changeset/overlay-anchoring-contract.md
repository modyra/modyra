---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": minor
---

Anchoring is a contract, and all three adapters apply it

`anchorOverlay` in `@modyra/widgets` turns a measured anchor and viewport into the placement, the
alignment, the height, the width and the exact `--mdy-overlay-*` coordinates a popup needs. Plain,
Lit and Angular now measure and apply; none of them computes a position of its own. It takes
`current` to keep an open popup's shape steady while its anchor moves, and `lock` for a host that
tracks the chosen corner itself — the locked height is measured for the locked side rather than
inherited from the side the policy would otherwise have picked.

Positioning also stops being something a theme can take back. The popup primitives are declared
last in the components layer, so no earlier per-widget rule can override an overlay's placement,
and Modern's docked `top: calc(100% + …)` rules are gone: a theme that positioned an overlay was
deciding whether a popup landed on its own control.

Every renderer now anchors popups to the control wrapper, as Angular always did — Lit anchored to
the whole field (label included, opening a row low and 240px off) and Plain's pickers were docked
inside the field with no shared positioning at all. Verified in the browser across five widgets in
two demos: 6px gap, aligned to the anchor's edge, stable under scroll.

The theme audit now reads Angular's `[panelClass]`, which had made every popup class Angular emits
invisible to it.
