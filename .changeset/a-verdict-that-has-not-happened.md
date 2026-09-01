---
"@modyra/core": minor
---

A form's verdicts can be carried from where it was built to where it is used

`mdyServerSnapshot(form, reactivity)` takes the verdicts a form has reached; `mdyRestoreSnapshot(form,
snapshot, reactivity)` starts one from them. `MdyServerSnapshot`, `MdyServerFieldSnapshot` and
`MdyServerVerdict` are the shapes they carry.

A field's verdict is `"valid" | "invalid" | "unknown"`, and the third is the point. An asynchronous
rule that has been asked and has not answered has reached no verdict, and a boolean has nowhere to
put that: reported as valid, a field arrives green on the strength of a rule that never ran. A
synchronous failure stays `invalid` while an asynchronous rule is still running — something is
already known to be wrong, and waiting does not change it. Whether a rule is still being asked is
carried separately, because the two answer different questions.

A restore re-derives from the values rather than installing the carried verdicts, so the two sides
must compute their way to the same answer instead of agreeing by construction.

The reactivity is passed explicitly and is not optional: one that has not declared
`serverSnapshots` is refused with an error naming the flag and the runtime, rather than serialising
verdicts that would disagree with what a person sees. `vanillaReactivity()` now declares it — and so,
by being the same engine relabelled, do the React, Preact, Svelte and Lit adapters. Angular, Vue and
Solid do not.

See ADR 0190.
