---
"@modyra/core": minor
---

A condition nobody can read does not open a section, and cannot hang the form

`MdyExpressionOp` is a closed set of twelve, and the two functions that read it disagreed about a
thirteenth:

```js
validateExpression({ op: "eqals", … }, "when")   // ["when: unknown operator \"eqals\""]
evaluateExpression({ op: "eqals", … }, value)    // true
```

A section meant to appear for one country was shown to everyone, and the values inside it went into
the payload — from one transposed letter. An unknown operator now evaluates to `false`: a question
with no answer is not answered with the one that opens.

The same asymmetry carried a cost. ADR 0050 gates patterns arriving through a document's
`validators.pattern`; `matches` is the **second** door a pattern arrives through, and it had no gate.
A `when` is read every time the form is read, so `(a+)+$` there does not make a slow form — it makes
one that stops answering between two keystrokes. `evaluateExpression` now applies the same cost
refusal and the same length cap, and `validateExpression` reports both the way it already reports an
unknown operator.

This reverses a documented default: an unreadable condition used to keep a section visible. A
validation whose condition cannot be read still never fires; a section whose condition cannot be read
now never shows. Recorded as
[ADR 0069](../docs/architecture/0069-an-unreadable-condition-does-not-open.md).
