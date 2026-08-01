---
"@modyra/widgets": minor
---

`MDY_CANONICAL_INVALID` declares what every renderer must produce for a field the user left invalid.

The invalid state had been *measured* once, by hand, on two renderers, and the two defects it found
were fixed and shipped. Nothing asserted it afterwards, so nothing stopped it regressing and Angular
was never measured at all. This is the assertion that should have carried that work: seventeen kinds,
three renderers, one expectation.

Derived from the resting expectation rather than restated — the invalid state *is* the resting one
plus what invalidity adds, and a second hand-written table would drift from the first the moment a
part moved. Three things change:

- `errors` and `errorItem` stop being optional. At rest a renderer may or may not materialise an
  empty list and both conform; once there is an error to show, showing none is not a free choice.
- `aria-describedby` becomes normative and must reach the error list. At rest it may name an empty
  description box or nothing at all, depending on the renderer.
- The field reflects `invalid` and `touched`.

**Fourteen of seventeen kinds now produce the same observation on all three renderers.** The six
remaining divergences are recorded in each adapter's ledger, asserted both ways so that a new one
fails and a stale one does too. Every one is a real defect rather than a permitted difference,
because the other renderers do the thing:

- Angular's `radio`, `multiselect` and `colors` carry no `aria-describedby` in the one state where
  there is something to describe — the error is rendered, styled, and announced to nobody. `radio`
  and `colors` never expose `aria-invalid` either.
- Lit's `multiselect` never exposes `aria-invalid`. Its error list is on screen and its reference
  reaches it, which is what hid this: only reading the state itself finds the gap.
- Plain's `datepicker` and `timepicker` never reflect `touched`, so the root carries no
  `mdy-renderer--touched` and the wrapper no error modifier — treatments three themes key off.
