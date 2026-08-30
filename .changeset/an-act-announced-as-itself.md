---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

An act that moves three values is announced as three

Clearing a multiselect said "Alfa removed, nothing selected" while three values went, and undoing that
clear said "Alfa added, 3 selected" while three came back. The count beside it was right the whole
time, which is what made the sentence sound like an account rather than a fragment: it invites a
listener to reconcile the halves themselves, and the reading that comes back is the one where they had
only ever chosen Alfa.

**Migration.** `MdyI18nMessages` gains three required members — `selectionAddedMany`,
`selectionRemovedMany`, `selectionRemovedManyLast` — carrying `{moved}` for how many changed and
`{count}` for how many are held. A consumer with its own message table supplies them. They are
required rather than optional on purpose: a table that cannot say the plural act is a table that will
say a smaller one, which is the defect this closes.

Counted rather than listed. The singular templates put the value before a verb that agrees with it, so
a list of names dropped into one is ungrammatical in every language that inflects — and twelve names
read out for a single act a person took knowingly is a list rather than a fact.
