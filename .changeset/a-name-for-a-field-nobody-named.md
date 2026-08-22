---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/styles": patch
---

A name for a field nobody named

A document may declare no label — the published corpus does — and everything inside a field's shell is
named by *pointing at* that label. With no words in it, a `radiogroup`, a `grid` and a `dialog` are
announced as their role and nothing else: "group", "grid", "dialog", with no way to tell which field a
person has landed in.

Two repairs, at the two levels where the question is answerable:

- **The option projection names the group itself** where no label was written — `aria-label` from
  `fieldAccessibleName` rather than `aria-labelledby` pointing at an empty element. A reference to
  nothing is not a name, and the contract already held the order to choose by.
- **plain's shell writes the fallback into the label** and keeps it out of sight. Every reference
  inside the field then resolves to words, whichever part made it. `clip-path` rather than
  `display: none`, which would take the label out of the accessibility tree along with everything
  pointing at it — a name is owed to a screen reader, a heading nobody asked for is not.
