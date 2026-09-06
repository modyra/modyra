---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/vue": minor
"@modyra/angular": patch
---

A chip's name and position come from the contract, not from four arithmetics

The projection had a per-chip answer — the name a reader hears, the column the cell sits in, the
strip's tab stop — and no renderer could reach it: `view().parts` is a record of part contracts, and
a repeated part needs an answer per instance. So four renderers worked it out themselves. Three
agreed by an arithmetic that happens to coincide (`wanted.length`, `index + 1`, `i + 1`) and the
fourth wrote nothing at all: vue's chips carried a role and no name, no position and no tab stop, so
a reader was told "cell" with no way to know which of how many or what was in it.

`multiselectChipPart(widgetId, key, appearance)` is that answer as a door, and
`MdyMultiselectFieldController.chipFor` hands it to a renderer. All four now ask it.

**Why a method and not a wider `parts`.** Letting `parts` carry a repeated part as a function is the
more general fix and it stays unbuilt: a public type should not be committed on one case. The
condition for reopening it is a **second** repeated part needing the same shape — options, calendar
cells — and whoever meets that case should widen the type rather than add a third method.

Classified major because `chipFor` is a required member of a published controller interface.

Verified by the property the door is for: an index planted wrong inside it moves all four renderers
together and in the same place. Before it, the same plant moved none of them.
