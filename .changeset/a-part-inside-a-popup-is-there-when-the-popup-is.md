---
"@modyra/widgets": minor
---

Fifty more optional parts say when they are on the page, derived rather than declared

The presence conditions went from 112 of 193 to 162 of 185, and not one of the fifty was written by
hand. A part inside a popup is present when the popup is, and the anatomy already answers which parts
those are — `dynamicPartsOf` walks the containment chain from any node whose element is a popup, and
the server split has read that answer since it existed.

Declaring them in the table would have been a second answer to a settled question, going stale the
first time a kind grew a part inside its overlay. The table still wins where it names one, so a part
with a sharper condition than "the overlay is open" keeps it.

`dynamicPartsOf` moved to `structure.ts`, beside the type it reads, and `ssr.ts` re-exports it from
the door it was published from. It could not stay where it was: `ssr.ts` reads the catalogue, and the
catalogue now needs the derivation while it is being built.

The anatomy is assembled in two passes, because containment is only readable once every node has its
parent. The shape is laid out first; the conditions are attached to it after.

Twenty-two parts are still silent — chips, file entries, spinner buttons, a select's displayed value.
Each was measured against a rendered page rather than reasoned about, and the page contradicted the
obvious guess: `clearAll` and `fileList` are on screen with no value at all, so "present when the
field holds a value" is wrong for them. They stay in the baseline. A missing condition is a gap; a
wrong one tells a renderer to build something at a moment nobody wanted.
