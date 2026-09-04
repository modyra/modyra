---
"@modyra/widgets": minor
---

A widget taken out of play is not open.

`MDY_DISABLED_BLOCKS_TRANSITIONS` is published `true` — *a disabled widget makes none of the moves its
table declares* — and it was read as a rule about what a widget may do next. It is also a rule about
the one state it can already be in: a panel standing open on a disabled field is not the result of a
move it is about to make, it is the residue of one it made while it still could.

The six controllers that hold an open panel now say so, through `staysOpen`, which lives beside the
constant it enforces. What it costs to get wrong is not tidiness: a document rule takes a field out of
play when another field changes, and the panel that stays is over a control nobody can operate —
reachable by the keyboard, offering choices that lead nowhere.

**Three renderers appeared to honour this and none of them decided it.** They draw the panel inside
the field, so it goes with the field's own treatment — the same accident of placement ADR 0206 ends
for a field leaving the document, met a second time on a different road. The browser tier reproduced
it through `disable`, and the field never left the DOM at all.

The three events are now distinct and each has an owner: end of life is the component's,
`closeWhenFieldLeaves` answers a field leaving the document, and this answers a field that stays and
stops being in play.
