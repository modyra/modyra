---
"@modyra/core": major
---

A commit word answers for the control a person types in

`MDY_VALUE_CONTRACTS`' `commit` column had two words and had never been compared against a widget. Two
kinds disagreed with it.

**A daterange is neither.** One endpoint writes nothing — a start with no end is not a range — and the
second writes both. Not `live`, because the first click does not write; not `confirm`, because there
is nothing to confirm. `MdyValueCommit` gains **`complete`**: the field changes when what the user is
building becomes a value at all, which is the sentence `completeRange()` already makes from the other
side.

**A colours field has two controls that commit differently.** The native swatch writes on every choice;
the hex box holds `#11` and writes on blur or Enter, because `#11` is not a colour. One word per kind
cannot say both, so the word answers for the control the label names and a keyboard types into — the
one a person can leave half-finished. `colors` is therefore **`confirm`**, with no change in behaviour:
what changes is that the published answer is now true for the control it describes.

Adding a member to a published union breaks an exhaustive `switch`, and anything branching on
`colors.commit === "live"` takes the other branch now.
