---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The error container is reserved under any field that can fail a rule, in all three renderers

Three renderers, three different answers to one question, and none of them was the contract's:

```
plain     reserved under every field, including ones with no rule at all
lit       rendered only when there was a message to put in it
angular   the same, and its templates could not tell the two apart
```

`presentWhen: fieldCanBeInvalid` said what the answer should be. Nothing applied it.

**The reservation is not for the field that is failing — it is for the field below it.** Somebody
leaving a field is moving toward the next one, and that is what drops when a message appears under
the field they just left. It does not stop every movement and must not be believed to: a two-line
message moves things anyway, and a validation arriving while focus is elsewhere defeats it. It closes
the frequent case, which is validate-on-blur. And it stays after a correction, because taking the
space back is the same jump, upward, under the same thumb.

Read from the field, never from its kind — an optional note with a length limit can fail a rule, a
note with none cannot and does not buy a line of scrolling on every screen. A field out of play
reserves nothing: the form is not asking about it, so it has no message to make room for.

**`aria-describedby` now names the error container and the supporting text, error first.** It named
one *or* the other, so the moment a field failed, the instruction that would have prevented the
failure stopped being announced. Ten places spelled that rule: the shell, five per-kind projections,
the option projection, two literals in Lit templates, and Angular's `describedById`. They call
`fieldDescribedBy`.

Naming a container that is always there also removes a class of defect rather than correcting it: a
reference that never changes has no moment at which it can point at an element not yet drawn, or one
already gone. An element with no text contributes nothing to a description — not a pause, not
"empty" — so a reader hears exactly what it heard before.

Two Angular specs asserted the reference was absent before a field was touched. That was how "names
something real" was satisfied when the container appeared with the first message; they now assert the
property itself, which is stronger and does not depend on the answer having been no.
