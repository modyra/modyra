---
"@modyra/widgets": minor
---

A number that does not change under a tremor

The ring was given memory and the angle was not, so half the flicker survived — the half a person
notices most. Twelve hours sit 30° apart, which puts the boundary halfway between two of them, and at
a hand of 100 **one degree is 1.75px of arc**. A finger resting near that boundary crossed it
repeatedly and the hour changed several times while the hand was, to its owner, still.

Nearest-value is the right answer to *which number is this* and the wrong answer to *should the number
change*. `timepickerDialPick` takes the value in hand and keeps it until the pointer passes the
boundary by **a quarter of the spacing** — a fraction of the spacing rather than a count of degrees,
because minutes sit 6° apart where hours sit 30°, and a margin that suits one is either nothing or
everything on the other. A granulated face uses its own spacing: four minutes 90° apart get a
quarter of *that*.

The controller passes the number it is holding, which it already had; no renderer grows any state.

Four properties, and the last is the one a fix that eliminated flicker by refusing to change at all
would fail: a tremor at the boundary changes nothing, no one-degree wander changes the value twice
anywhere on either face, a deliberate move to the next number lands in exactly one change, and a
granulated face keeps the rule at its own spacing.
