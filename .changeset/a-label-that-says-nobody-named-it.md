---
"@modyra/widgets": minor
"@modyra/styles": patch
---

A label can say it was never written

Everything inside a field is named by pointing at its label, so a field a document gave no name to
had to be given words anyway — `fieldAccessibleName` chooses them. Plain marked such a label with a
class of its own invention so a theme could keep it out of sight, since a name is owed to a screen
reader and a heading is not.

`unwritten` is now a state of the shell's label, and `projectFieldShellA11y` emits it when a caller
passes `nameSources` and neither a label nor an `aria-label` was written. Callers that pass nothing
are unaffected: the label carries no such claim and nothing changes.

The theme also gains the two chip states it declared and never painted — a chip in flight during a
drag, and the tooltip that gives the full name of a chip the strip had to cut short, which until now
was unstyled text that widened the row it was explaining.
