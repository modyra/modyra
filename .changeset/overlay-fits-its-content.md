---
"@modyra/widgets": minor
"@modyra/styles": patch
---

A popup is placed where it shows whole

`anchorOverlay` takes the popup's measured size — `contentHeight` and `contentWidth` — and places it
where the content fits rather than merely where there is room. A 280px calendar with 264px below its
control and 288px above now opens above and shows whole, where the minimum-space rule opened it below
and let it scroll. Horizontally the popup hangs from the edge that has room for it, and one too wide
for either edge is moved bodily back inside the viewport instead of being left over it.

`MdyOverlayDecision.fits` reports whether the content fits the space decided for it, so "does not
scroll" is something a test can assert. `MDY_OVERLAY_VIEWPORT_MARGIN` and `MDY_OVERLAY_GAP` are
exported, since the arithmetic is only reproducible if the two distances it uses are named. Every
placement emits `--mdy-overlay-max-width`, which the foundation applies, so even a popup nobody
measured cannot run off the screen.

Both inputs are optional and the behaviour without them is unchanged: no measurement means the
previous minimum-space rule, and `fits` is `true`, since a missing measurement is not evidence of a
squeeze.
