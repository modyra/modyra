---
"@modyra/widgets": minor
---

The words inside a value chip, and how many are held, are parts the contract names

A multiselect declares `chip`, `chipMove` and `chipRemove`, and declared nothing for the **words**
inside a chip or the count beside them — while the entry in the *list* has carried `optionLabel` and
`optionCount` from the start. Every renderer drew those two elements and gave them classes the
contract reserves for the list entry, so no tool could ask about them, and one renderer drew them
with no class at all until a width moved and made it visible.

They are now `chipLabel` and `chipCount`, present exactly when a chip is.

**Naming them exposed four places that told two parts apart by document position.** Where two parts
carry identical classes — which is what naming these created — the resolution took "the Nth match",
and that is right only while both are drawn in the expected order. The walk, both lookups and the
canonical snapshot now narrow by the parent the contract declares, and treat a parent that is nowhere
on screen as a parent that is not holding the part. Before that, the chip's words took the first
*option's* label, and the option's own part was then reported missing: one guess, two wrong answers.

**Classification.** `contract:diff` reports 24 major. Twenty-two of those are one sentence repeated —
`reading order: position 31 → 33` — because two parts inserted in the middle shift the absolute index
of every part after them. No part's order **relative to its siblings** changed, and the only semantic
entries in the whole diff are the two the tool itself calls minor: `new optional part`, twice. The
verdict shipped is the tool's; the disagreement is recorded here because it is a measurement, not a
preference.

**A filled multiselect owes a chip, and the chip owes its words.** At rest there are no chips, so
the strip and everything in it is optional. Filled, that chip is the only thing on the page saying
what the field will submit: a filled multiselect drawing no chip — or a chip whose words carry
nothing that can be found — submits a value nobody can see, which is the worst shape in the register
rather than a cosmetic gap. `chipRemove`, `chipMove` and `chipCount` stay optional, because whether a
value can be taken off, reordered, or held more than once are the field's own affordances and a chip
without them still says what it holds.

Falsified against the defect that started this: with the words drawn under no class again, under a
clean build, the canonical filled observation reports `missing part: chipLabel`. Before this change
that same replant passed everything.
