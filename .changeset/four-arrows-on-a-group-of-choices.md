---
"@modyra/widgets": minor
---

A group of exclusive choices declares all four arrows

`radio` and `segmented` declared `ArrowUp` and `ArrowDown` and nothing else, while the paragraph
beside the table already said the ARIA authoring practices give a radio group *the four arrows*. One
renderer honoured all four and the others did not, so a gesture somebody learned in one was gone in
another.

**The layout is a visual choice, and somebody who cannot see it does not know it.** A screen reader
announces "group, 1 of 4" and says nothing about a row or a column, so a person presses whichever
arrow comes to hand and it has to work. A group answering only its own axis makes them guess an axis
that was never announced.

`ArrowLeft` and `ArrowRight` are declared for radio groups only — the kinds whose parts carry
`role="radiogroup"`, asked of the catalogue rather than of a second list.

`Home` and `End` stay undeclared, and the reasoning already in the file is right: they serve a set
longer than can be seen or held in mind, and three or four always-visible choices are crossed in three
presses. A renderer offering them is not in breach — nobody expects them, so nobody loses them moving
between renderers — but declaring them would widen the contract without closing any gap.
