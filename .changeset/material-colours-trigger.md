---
"@modyra/styles": patch
---

Material's colour trigger can be clicked

Under `modyra-material.css` the palette's chevron measured **44×0** — no height at all — so it could
not be clicked by a user or by a test. The other three stylesheets gave it 36–56px.

The theme set `height: 100%` on it. The foundation already stretches that button with
`align-self: stretch`, and a percentage height on a flex item whose parent has no *specified* height
resolves to nothing: the theme's declaration wins the cascade and then amounts to zero. Stretch is
what fills the row; a percentage only claims to.

The cross-theme palette test now clicks the trigger like a user in every theme, rather than reaching
past the pointer to open the popup — which is how this was found in the first place, and what it
takes for the test to catch it. It fails against the previous stylesheet.
