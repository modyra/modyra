---
"@modyra/widgets": patch
"@modyra/lit": patch
---

The kit asks every renderer what it does with a value of the wrong shape

Three tools were measured against two planted defects of this class — one in the shared projection,
one in a mature adapter — and all three missed both. The reasons differed, which is the useful part:
the kit ran ten of twelve sections and the two absent ones need a browser session; the node battles
have no test on renderer projections; and no browser spec ever hands a wrong-shaped value to a date
kind. What the two plants had in common was not where they lived — it was that nothing interrogates
an input *by shape*.

This closes the kit's half. A new section holds a value of five wrong shapes in the model of every
kind a config draws, and demands the control still be there. It reads what the renderer *reported*
as well as what it left in the tree, because a framework that catches an exception inside its own
update keeps the last good render on the page — measured: a planted defect threw on every renderer
and left every DOM intact, so a section reading only the tree called it a pass.

Fixtures gain `hold(value)`, declared alongside the kit's other members: it puts a value where the
engine keeps it. Declaring one is a different door, and correctly refuses a wrong shape with a
warning — a section asking that way would grade a widget nobody enquired about.

The section's first run found one: Lit's select spelled an option's key `String(value)`, which is
`"[object Object]"` for every object, while the projection keys such an option structurally. The two
agreed for scalars and diverged for anything else, so the lookup missed and reading the missing part's
id threw while the list was drawn. It now asks the contract for the key.
