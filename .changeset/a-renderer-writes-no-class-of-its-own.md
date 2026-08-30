---
"@modyra/plain": minor
---

Removed five classes this renderer wrote that the widget contract does not declare

`mdy-plain-form`, `mdy-plain-colors`, `mdy-plain-datepicker`, `mdy-plain-daterange` and
`mdy-plain-timepicker` no longer appear in the rendered DOM. **A stylesheet selecting them stops
matching.**

They were hooks for a plain-only stylesheet whose rules were deleted a month ago when that styling
was folded into the contract's own vocabulary. The hooks outlived the rules: styled by nothing,
selected by nothing, and present on four of eleven field renderers rather than all of them. A mark on
some of the kinds is not a convention.

Nothing in this repository selected them — no stylesheet, no demo, no example, no end-to-end spec.
Plain's own tests did, and they now select the classes the contract declares: the `root` part already
carries `mdy-renderer--datepicker` and `mdy-renderer--daterange`, which is what distinguishes the two
kinds that share `mdy-datepicker`. The distinguishing class was in the page the whole time.

Anything reaching for a removed class has a contract class in the same position:
`.mdy-plain-datepicker` → `.mdy-renderer--datepicker:not(.mdy-renderer--daterange)`,
`.mdy-plain-daterange` → `.mdy-renderer--daterange`, `.mdy-plain-timepicker` →
`.mdy-renderer--timepicker`, `.mdy-plain-colors` → `.mdy-renderer--colors`, `.mdy-plain-form` →
`.mdy-dynamic-form`. Every one of them is written by all three renderers, so a rule moved this way
applies where the plain-only class never could.

Plain's conformance suites no longer claim the `adapterPrefix` exemption, so all three renderers are
held to the same check with nothing exempted between them. The residue could not have been found
while it was claimed: the gate that fails on an undeclared class was being told to skip these.

See ADR 0162.
