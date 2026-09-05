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

**What this does not yet do.** It does not catch a renderer that draws the words without the class —
the defect it was written for. Measured: with that defect replanted under a clean build, every check
still passes, because the part is optional and an optional part that is absent is not owed. Making it
owed means deciding that a filled multiselect **must** show a chip with words, which the canonical
filled observation currently leaves optional for the chip itself. That is a decision about what a
filled widget must show, not a gap in this change, and it is recorded rather than assumed.
