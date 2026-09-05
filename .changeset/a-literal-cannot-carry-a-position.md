---
"@modyra/widgets": major
"@modyra/vue": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

`keepKeyboardInPlay` takes the observation instead of a claim about when you are asking

**Migration**: replace `{ afterBlur: true }` with `{ heldTheKeyboard: <whether this widget held the
keyboard, observed before the control left play> }`. From inside a blur handler that is
`element.contains(event.target)`; a caller that takes the control out of play itself can drop the
option entirely, because the keyboard is still on the element and the function can see it.

`afterBlur` meant "I am asking after the platform blurred the control", which is a claim about where
the *caller* stands in time. It is true written inside a blur handler and false written in a render
effect, and the value is identical in both — so the compiler accepted an assertion where an
observation was needed, and a field disabled on a page the person had never touched pulled the
keyboard into itself. The option is renamed rather than documented harder, because the name is
what a reader checks against: a pinned `true` now reads as a false statement about an observation,
where before it read as a flag someone raised.

**What this does not do is enforce it.** `heldTheKeyboard?: boolean` still accepts a literal from
anywhere, so the type is not the guard — the kit section is, and it drives the symptom on any
renderer. A stronger signature (a value only an observation can produce) is identified and deferred
in ADR 0209 rather than claimed here.

Every caller in this repository is migrated in the same change, and a kit section now drives the
symptom — a widget nobody reached, taken out of play, must not take the keyboard — so a renderer that
gets this wrong is caught whatever mechanism it gets it wrong through.
