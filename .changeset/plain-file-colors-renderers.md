---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/styles": patch
---

Render `file` and `colors` for real, retiring the placeholder renderer: a drop zone with a browse
button, a file list and a clear action driven by `fileSelectionTransition`, and a colour control with
a preview swatch, hex field and preset palette driven by `colorValueTransition` — which is also what
decides that picking a preset closes the popup while typing a hex value does not. Popups are placed
through a shared helper that applies `decideOverlayPlacement` and writes the `--mdy-overlay-*`
properties the themes read. The catalog now names the classes for these parts, so an adapter takes
them from the contract instead of inventing them, and the caret a renderer without an icon set
leaves empty is drawn by the theme through `:empty` rather than by naming that renderer.
