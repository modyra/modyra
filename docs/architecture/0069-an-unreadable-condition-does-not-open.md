# ADR 0069: An unreadable condition does not open

Status: Accepted

## Context

`MdyExpressionOp` is a closed set of twelve, and two public functions read it. They disagreed about a
thirteenth:

```js
validateExpression({ op: "eqals", … }, "when")   // ["when: unknown operator \"eqals\""]
evaluateExpression({ op: "eqals", … }, value)    // true
```

One refuses it by name. The other answers, and answers **true** — which for a visibility condition is
the most consequential answer available. Measured on a section governed by one: a group meant to
appear only for a single country was shown to everyone, and the values inside it went into the
payload.

The same asymmetry carried a cost. ADR 0050 put a gate on patterns arriving through a document's
`validators.pattern`, and it works. A pattern arrives through a **second** door: `matches` is one of
the twelve operators and its right operand is a pattern string, so every section's `when` and every
field condition can carry one. That door had no gate:

```
buildDynamicValidators({ pattern: "(a+)+$" })   answered in 13 ms   the gate of ADR 0050
evaluateExpression matches "(a+)+$"             killed at 1000 ms   still running
```

A `when` is read every time the form is read. So a document carrying one of these does not make a
slow form: it makes a form that stops answering between one keystroke and the next.

Three findings now share one sentence: **what the author-time check knows is not what the evaluator
applies.**

## Decision

**A question with no answer is not answered with the one that opens.** An operator nobody declared
evaluates to `false`. A section governed by an unreadable condition is hidden and its values stay out
of the payload, which is the direction that loses nothing a person can see and reveals nothing they
could not.

**The evaluator carries the same cost gate as the parser.** `matches` refuses a pattern longer than
the cap and one `dynamicPatternRefusal` names, and a pattern that cannot be afforded decides nothing
— it evaluates to `false` rather than running.

**The author-time half reports what the evaluator refuses.** `validateExpression` now names a costly
or over-long pattern the way it already names an unknown operator, so a document carrying one is
refused where documents are refused rather than only being inert at runtime.

**The depth cap is not part of this.** An expression nested past `MDY_MAX_EXPRESSION_DEPTH` still
evaluates to `true` at the cut: that cap limits what a *document* may carry, and an expression built
in code and nested deeper is still readable. Answering `false` there would make this function refuse
work nobody asked it to police — which a battle already pins in those words.

## Consequences

This reverses a documented default. The old comment argued `true` was the safe direction — *"a
visibility rule keeps the field visible, and a validation whose condition cannot be read does not
fire"* — which is true of the validation half and wrong about the visibility half, and the visibility
half is the one that decides what a payload carries.

A validation whose condition cannot be read now never fires, as before. A section whose condition
cannot be read now never shows, where before it always did. A consumer with a misspelled operator
sees a section disappear rather than a section that ignores its rule; both are wrong, and the one
that disappears is the one they will notice.

`matches` gains the pattern cap and the cost refusal, so a condition whose pattern is legitimate but
expensive by that heuristic stops matching. The heuristic is the one already shipping for validators,
and this makes the two doors agree rather than introducing a second judgement.

## Alternatives rejected

**Throw on an unknown operator.** A condition is evaluated on every read, so throwing turns a
document defect into a form that cannot be rendered at all — the failure that ADR 0050's iterative
walk and this record both exist to avoid.

**Keep `true` and rely on `validateExpression`.** It is the state that produced the finding: the
evaluator is reachable without the parser — an expression assembled in code, a path that skips the
document door — and the checked half cannot protect the unchecked one.

**Gate the pattern only at parse time.** It leaves `evaluateExpression` as a public function that
hangs on an argument, which is a denial of service in a function a consumer may call directly.

## Verification

- `battle-tests/adversarial/security/an-operator-nobody-declared.battle.test.mjs` — the
  misspelled operator against a section, with the correct spelling opening and closing as the
  controls.
- `battle-tests/adversarial/security/the-other-door-a-pattern-comes-through.battle.test.mjs` — the costly
  pattern through both doors, measured in a child process under a budget, with an ordinary pattern
  through the same door as the control.

## Security and privacy

Both halves are security repairs on the untrusted-document surface. The first closes a way for a
document to show a section a consumer meant to hide — with whatever the section holds going into the
payload — through nothing more than a misspelling. The second closes a denial of service: a
`when` is read on every read of the form, so a catastrophically backtracking pattern there stops the
form answering, and `evaluateExpression` is public, so it is reachable directly as well as through a
document.
