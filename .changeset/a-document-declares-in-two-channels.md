---
"@modyra/widgets": minor
"@modyra/vue": major
"@modyra/plain": patch
---

A document declares in two channels, and the conformance kit now asks about both. ADR 0205.

**Rules judge a value** — the engine builds a validator, and the section above already asks whether
they reach the control. **The rest draws it**: a slider's `step`, a `placeholder`, the name a control
has where nothing captions it. No validator vocabulary carries those, and the refusal is the thesis
rather than a gap — a slider's step is *dropped* where it would move the thumb off the value the
field holds, and a rule that gives way is not a rule.

So the kit gains a `config` channel and a section that asks whether those declarations arrived. An
adapter opts in with `declaresConfig`, exactly as `declaresRules` works, and one that does not is
reported as not run rather than as passing.

**What it found on its first run, in `@modyra/vue`: five kinds with no accessible name at all** —
checkbox, toggle, file, datepicker, timepicker, and then colours — when a document declares one and
nothing else captions the control. Each now takes `ariaLabel` and puts it on the control a person
operates.

The name is read as a name. `aria-label` is one of four ways an element gets one, and the reference
renderer uses another for two of its kinds: a caption element carrying the words, associated by
`for`. The first version of this section read the attribute and reported those two as nameless —
a renderer a browser announces correctly, accused by a check looking in one place.
