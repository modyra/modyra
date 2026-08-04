---
"@modyra/styles": patch
---

A visually hidden native control is never painted.

Checkbox, radio, toggle, segmented and file keep a real `<input>` for the accessibility tree, the tab
order, the form post and the keyboard model, clipped to a single pixel while a sibling draws the
appearance. The general field rules reached those inputs and gave them a focus background and shadow
— invisible by construction on a clipped pixel, and in WebKit fatal: focusing a checkbox or a radio
under `modyra-modern` ended the page, so a keyboard user lost the document on reaching one.

The six duplicated copies of the hiding pattern are now one rule that clears `background-color` and
`box-shadow` along with the geometry.

No migration. Nothing visible changes — the affected elements had no visible surface, and the
screenshot baselines are unmoved. A host that copied the hiding pattern into its own stylesheet
rather than using the shipped one should clear both properties there too.
