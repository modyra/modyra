---
"@modyra/widgets": patch
"@modyra/vue": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

A control names a description only when there is one to read

`aria-describedby` asserts that a description exists. Every kind's projection defaulted to claiming
one — `descriptionVisible ?? true` in seven places — so a renderer that draws the element
unconditionally pointed at it while it was empty: a reader is sent somewhere to hear nothing, which
costs them the move and teaches them not to follow the next reference, and "I have a description, and
it is empty" reads exactly like "I have none".

The default is now the honest one: a description exists when the renderer says it drew one. Measured
across eleven kinds in three renderers, at rest and while the field is refused — no reference now
names an empty element anywhere, and every refused field still names the text that says why.

The same rule now decides whether the contract's DOM check *demands* a relation: it is owed when its
target holds something to read. A container a renderer **reserves** — drawn under every field that
can fail a rule, so the reference never has to change — keeps its reference; this only stops
requiring one while it is empty.

This is the rule the errors half of the same reference was repaired to follow, and the sentence
warning against the shape was already written above the option that defaulted the other way.
