---
"@modyra/angular": patch
"@modyra/lit": patch
---

The adapters write custom properties by name, not by literal

Angular and Lit each spelled `--mdy-overlay-left` and its seven siblings out by hand — Lit to write
them onto the host and read them back into a style string, Angular to parse the numbers back out for
the CDK. Both now take the names from `MDY_CSS_PROPERTIES` in `@modyra/widgets`, which is where
`anchorOverlay` writes them, so the two sides of the same handover cannot drift apart. The slider's
fill percentage follows the same route in both adapters.

Lit's popup also sets `--mdy-overlay-max-width`, which it computed and then dropped: a content-sized
popup near the edge of the viewport had nothing bounding its width.

**Golden baseline change, classified as an extraction artefact.** `angular-ui.json` loses four
entries — `mdy-slider-fill-pct`, `mdy-segments-count`, `mdy-label-left-offset` and
`mdy-fl-input-padding-with-prefix`. None was ever a class: they are custom properties that the
extractor's `\b` boundary matched without their leading `--`, so a manifest of classes had been
carrying four properties since it was first written. The extractor now excludes them and the
remaining 237 classes, 16 ARIA attributes and 40 selectors are unchanged.
