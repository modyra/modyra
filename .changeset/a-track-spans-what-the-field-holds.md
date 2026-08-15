---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

A slider's track spans the number the form holds

A slider spans something whether or not a document declares a range, and the default turned into a
misrepresentation:

```jsonc
{ "kind": "slider", "initialValue": 150 }   // no bound declared
// the form holds 150, the page draws a track ending at 100 and puts the thumb there
```

`step: 5` did the same to a value of 7 — the platform snaps a range input to a multiple — and neither
case said anything, because neither is a rule: no bound was declared, and the validator vocabulary
has no `step`. Both renderers had invented the same `?? 100` separately, so they agreed about a lie.

`sliderTrack(constraints, value)` is now the one place the range is decided. It widens to include the
value **only where nothing was declared** — a declared `max` is kept, because the attribute is the
native guard and a value past it is refused with a message since the bound became a rule. A `step`
that would move the thumb off the value is dropped.

The drawn range is no longer a constant: a slider with no declared bound and a large value draws a
track that reaches it. `nativeConstraintAttributes` and `MdyFieldShellA11yOptions` take an optional
`value`; omitting it keeps the previous behaviour, which is right for every kind that draws no track.

Recorded as [ADR 0067](../docs/architecture/0067-a-track-spans-what-the-field-holds.md), which also
states the ordering Lit now depends on: a range input clamps its value to the bounds it carries when
the value is assigned.
