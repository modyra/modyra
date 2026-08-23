---
"@modyra/widgets": minor
"@modyra/angular": patch
---

A field showing its errors inline still says it is failing.

`projectFieldShellA11y` wrote `aria-invalid` from `errorsVisible` — the flag that says *which element
holds the words*, so that `aria-describedby` never names an element that is not in the document. With
errors drawn **inline** there is no error list, so that flag is false, and the control announced
itself valid while the field beside it was painted as refused and an icon stated the reason.

The two questions are separated: `aria-describedby` still follows what was rendered, and `aria-invalid`
follows the verdict. The new `invalid` option defaults to `errorsVisible`, so a renderer that draws its
errors one way only is unaffected.

`@modyra/angular` passes its own answer, which is the same one the wrapper's error class takes — so
what a theme paints and what a screen reader is told cannot disagree.

Found by the themed end-to-end suite, on a page configured the way a product configures one.
