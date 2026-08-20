---
"@modyra/styles": patch
---

A calendar's adjacent-month days are readable

The days a calendar greys out — the ones belonging to the month either side — measured **3.06:1**
against the surface behind them, where AA asks 4.5:1 of normal text. They are not decoration: they
are dates a person reads and can click.

The mechanism was `opacity: 0.5` on the cell, not a muted colour, and that is why the defect was
invisible to the palette checks. A faded value composites against whatever is behind it, so one
number is several contrasts — 3.06:1 on the resting surface, 3.01:1 on a hovered cell, and different
again in the dark scheme.

`--mdy-comp-date-picker-cell-outside-opacity` is **0.7**, chosen against the worst of those grounds
rather than the resting one. Measured across light and dark, resting and hovered, the tightest is
5.40:1 and the day still reads as clearly muted — full-strength text on that surface is 14.05:1.
A disabled day is the exception AA itself makes and keeps its own 0.25.

A theme overriding the token takes the same obligation with it.
