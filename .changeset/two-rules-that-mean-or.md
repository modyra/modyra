---
"@modyra/core": major
---

Two rules that each show a field show it

`applyDynamicRules` composed both effects over *switched off*: a field was out if any rule said so.
For the negative effects that is what an author means. For the positive ones it inverts them —
`visible when C` is *off unless C*, and two of those compose to "off unless C₁ or off unless C₂",
which is in play only when **both** hold. An author writing "show this for a business, and also for a
charity" got a field nobody was ever shown, submitted for nobody.

A positive rule is a way in and any one of them is enough; a negative rule is a veto and holds whatever
else is true. A veto still beats a way in.

**A rule's `value` is checked against the operator that will read it.** Four of a rule's five members
were guarded and the one the operator actually consults was not: `greaterThan` against an object, `in`
against a string, `notIn` against a number all parsed clean in strict mode and then answered the same
thing forever. A rule that can never fire is indistinguishable from a rule nobody wrote. Comparing
dates is comparing strings, so a comparison on a date field requires a full ISO date — `"2026-2-01"`
sorts before `"2026-1-10"`, and the zero padding is what hides it. The published v2 and v3 schemas say
the same thing, so the document a schema validator accepts is the document the parser accepts.

**`in` and `notIn` are complements.** Answering `false` to both when the value is not a list made the
careful spelling give the same answer as the one it was written to be safer than.

**`MdyExpressionOp` gains `in`, `notIn`, `greaterThanOrEqual` and `lessThanOrEqual`.** The flat rule
predicate had four operators the expression tree did not know, so a document could write an operator
nothing published could check. One vocabulary now answers both shapes. Adding members to a published
union is breaking for an exhaustive `switch`.
