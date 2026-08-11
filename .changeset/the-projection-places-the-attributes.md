---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

No renderer names a constraint attribute any more: the projection places them.

The previous change had every renderer read the field's rules and write `minlength`, `maxlength`,
`pattern`, `min`, `max` and `step` itself. The conformance kit found two renderers that had missed
some — and that is the finding, not the two renderers: **if forgetting is possible it eventually
happens.**

`projectFieldA11y` and `projectFieldShellA11y` now emit the native constraints beside the ARIA they
already emitted, so a renderer that binds the control part offers them without naming one. A control
that wants to offer *less* than the field accepts says so once through the controller
(`constraints`, read rather than captured, so a limit set after mount is honoured) and the projection
composes the two: whichever end is tighter, never wider than the rules.

**All fourteen Angular renderers now bind `[mdyPart]`** — the five that did not are exactly the five
where constraints had to be hand-written, which is what made the omission possible. Adding a
constraint tomorrow touches the projection and the per-kind translation, and no renderer at all.

A slider's default 0–100 span moved to the same place: a slider must span something to be drawn, and
that is the kind's own default rather than something each renderer remembers.

Also in this change:

- `withFacts` no longer tags the function it is given. It is exported, so that function may be one
  the caller uses elsewhere; it returns a wrapper.
- `mergeFacts` combines through a table of strategies, so a fact added tomorrow cannot compile
  without saying how two of them add up.
- `MdyRecordManagerDeps.sections` / `MdyArrayManagerDeps.sections` are `() => boolean`: they were
  already bound to what they read, and the two-argument shape invented arguments nobody supplied.
- The two Angular source audits now read the rule they already stated — a renderer satisfies an ARIA
  token by naming it *or by naming the directive that supplies it*.

See ADR 0030, amendment "the projection places the attributes".
