---
"@modyra/core": patch
---

Two values that hold the same thing are the same value

ADR 0051 lets an option carry an object, and a document carries its options in one place and the rule
that names one in another — two hand-written literals, or two results of a single `JSON.parse`, never
the same object. Compared by identity, a rule over such an option could not come true for any choice
the document itself declares, and strict mode accepted it: a `visible` rule that revealed nothing
ever, or a `hidden` rule whose field was shown to everyone with its values in the payload.

`equals`, `notEquals`, `in` and `notIn` now compare objects and arrays by what they hold, in both
halves of the vocabulary, depth-capped like the tree around them.
