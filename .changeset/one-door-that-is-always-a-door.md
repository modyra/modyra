---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

One door out of the ready colours, and it is always a door

The panel held two things for a colour picked by hand: a swatch among the ready ones, selectable like
them, and a separate line of text that opened the platform's chooser. Lit held a third — an untranslated
button duplicating the second.

There is one now. It previews the last colour picked by hand and **pressing it always opens the full
chooser**, in every state, without exception. The tint it carries is not a value: it is a preview of
where the chooser will open. It never takes the selected mark, because a thing marked as chosen that
opens a panel when pressed contradicts itself inside a single element.

That costs something real and the cost is taken knowingly: somebody who picks a free colour, tries a
ready one and changes their mind reopens the chooser rather than pressing back — a cost on a rare path,
in preference to an element that does one thing when empty and another when full, which is a cost on
every path and which nobody can predict by looking.

Which colour the field currently holds is shown by the filled square on the field, whose only job that
is. The two are necessarily separate: with preset three held and a free colour typed before it, the
square must show preset three and the door the free colour, and one element cannot show two colours.

**The door is legible as a door.** A shape of its own, an outline where the ready colours are fill
alone, a mark that is drawn whatever it is showing, and a rule between it and the row. The mark sits
beside the tint rather than over it — over the fill it would have to be legible on yellow and on navy
at once, which no fixed colour is — so it takes the panel's foreground and obeys an imposed system
palette while the tint keeps its colour, because in this control the colour is the content.

**Migration.** `colors` gains one optional part, `customTint`, carrying `mdy-colors__custom-tint`;
`contract:diff` classifies it minor. `colorCustomEntry` now reads "All colours…" rather than "Custom…",
in all five languages: it names the dimension the two commands differ in, which is how many colours you
can reach. `colorCustomValue` is no longer used by any renderer here and is kept for consumers that
name their own swatch.

Behaviour on the door itself changes: a renderer or test that pressed it expecting a selection now gets
the chooser. ADR 0158 carries the reasoning.
