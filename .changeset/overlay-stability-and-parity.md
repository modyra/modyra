---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": patch
"@modyra/styles": minor
---

Overlays keep their shape, never take part in layout, and always sit above field feedback

Every `popup` part in the catalog now carries `MDY_POPUP_CLASS` (`mdy-popup`), and the foundation
takes anything wearing it out of flow. Lit's multiselect rendered its overlay content into a
`display: contents` panel, so the options were laid out inline and pushed the page down on open;
that guarantee is now the contract's rather than each renderer's.

`stabilizeOverlayPlacement` keeps an open overlay's side, height and alignment fixed while its
anchor moves: coordinates follow the anchor, but re-deciding the shape on every scroll frame is
what made popups flip and resize as the page scrolled. Plain holds the decision for the lifetime
of one opening.

`@modyra/styles` gains a documented stacking scale (`--mdy-z-raised` … `--mdy-z-portal`) and the
raw `z-index: 999/1000/9999` values now take rungs from it, with errors and supporting text placed
below overlays so field feedback can never cover an open popup. Segments are equal-width with the
check gutter reserved in every state, so selection no longer resizes the bar and two renderers with
different labels produce the same geometry. The toggle track is border-box, so its height and
radius no longer change between off and on. Plain's select renders the contract's `placeholder`
part instead of a modifier class on the value, and its radio/segmented options put the drawn
control on its own element rather than on the native input.

The Angular UI golden baseline changes only by the three CDK popups gaining `mdy-popup`.
