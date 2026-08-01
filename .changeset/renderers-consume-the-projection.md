---
"@modyra/angular": patch
"@modyra/widgets": minor
---

Angular renderers take their semantic state from the shared projection

The slider, radio group and file input bound `aria-invalid`, `aria-required` and `aria-describedby`
and never `aria-disabled`; the segmented control bound `aria-disabled` and never `aria-invalid`.
Each template was its own answer to what a control must expose, so no two agreed.

Those four now bind `[mdyPart]="controlPart()"` and receive all of it from the projection in
`@modyra/widgets`. An attribute added there reaches the DOM without a template being touched.

`projectFieldShellA11y` gains `descriptionVisible` alongside `errorsVisible`. A projection cannot
know which of a control's descriptive elements a renderer actually emitted, and naming one that is
absent leaves `aria-describedby` pointing at nothing — so the renderer answers, and a control with
neither an error list nor supporting text describes itself by nothing.
