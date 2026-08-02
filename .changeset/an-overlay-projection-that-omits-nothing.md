---
"@modyra/widgets": minor
---

`overlayStyleProperties` carries the whole placement decision.

`anchorOverlay` writes eight `--mdy-overlay-*` properties. `overlayStyleProperties` — the projection
for a host that carries coordinates around instead of the property map — wrote five. It had no
`transform`, no `max-height` and no `width`, so every host on that path completed the decision by
hand, and they did not complete it the same way: Angular stated `80vh` for a modal placement where
the policy computes 70% of the viewport. The same popup, having given up on its anchor, was a
different size depending on which renderer drew it.

`MdyOverlayCoords` gains `maxHeight` and `placement`. The placement is what makes the modal case
expressible at all — centring on the viewport is a percentage offset and a translation rather than
the measured insets every other placement uses, so without it there was nothing for a host to
serialise and each one invented the centring itself.

A contract test now holds the two projections to each other across `below`, `above`, `overlay` and a
content-sized popup. It found a second disagreement on its first run: an unused inset is `auto` in
`anchorOverlay` and was `unset` here, which leaves `var()` invalid at computed-value time and lets a
stylesheet fallback answer instead. Both now say `auto`, the value the themes have always been read.

Angular's overlay panel no longer states any of it, and its `maxHeight` input — which the height now
reaches through the coordinates — is gone along with the six bindings that fed it.
