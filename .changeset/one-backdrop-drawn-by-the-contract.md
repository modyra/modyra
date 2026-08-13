---
"@modyra/widgets": minor
"@modyra/styles": minor
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

One backdrop, drawn by the contract and painted by the theme

`.mdy-overlay-backdrop` is in `MDY_SHARED_UI_CLASSES` and no theme painted it, so
the token beside it — `--mdy-overlay-backdrop-bg`, with a dark ramp — was
declared and read by nothing. What the three renderers did instead was three
different things: Angular wrote `rgba(0,0,0,0.32)` inline, so no product could
change how its modals dim; Lit drew the element under *every* open popup,
dropdowns included, which is why painting it would have dimmed the page behind a
select; and the framework-free renderer drew none at all, so its modals never
dimmed.

The theme paints the class now, and `setOverlayOpen` draws the element when the
placement is modal — `syncOverlayBackdrop` for a renderer that learns the
placement a moment after showing the popup, which is what measuring first means.
"A modal dims what is behind it" is not a rendering decision each adapter gets to
make differently.

`audit-contract-style-coverage` also reads `MDY_SHARED_UI_CLASSES` now. It
enumerated parts, popup, portal, shell, layout and chip and skipped the table of
classes belonging to no single kind, so nine classes the contract declares were
reported as outside it and sat in the allowlist for that reason alone.
