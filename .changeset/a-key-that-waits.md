---
"@modyra/widgets": minor
---

A binding can name the state it waits for

`Ctrl`/`Cmd`+Z puts back a multiselect's last removal, and on a field where nothing has been removed
it correctly does nothing — which from outside is indistinguishable from a key nobody implemented. A
sweep over every declared key found it and reported it unanswered.

`MdyKeyBinding` gains `awaits`, naming a transient state the field must already be in. It sits beside
`requires` and answers a different question: a capability is true for as long as a document says so,
a state has happened and can stop being true again. The test is whether the answer can change while
nobody touches the document.

A check may now arrange the state before pressing or count the key as unreached; a legend says *when*
a key applies rather than promising it always. ADR 0157.
