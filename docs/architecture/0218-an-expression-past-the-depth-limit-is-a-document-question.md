# ADR 0218: An expression past the depth limit is a document question

Status: Accepted

## Context

`evaluateExpression` stops descending at `MDY_MAX_EXPRESSION_DEPTH` (32) and answers `true` for
whatever lies deeper. A security scan flagged that answer as fail-open: a `visible` rule nested too
deep would show what it governs.

Two facts bear on it. A document cannot carry such an expression: the parser refuses a condition
deeper than the limit, together with unknown operators, wrong arities and patterns that are not
literals. So the evaluator only meets one built in code, by a caller of the public function. And no
constant returned at the bottom is closed in every position. Under a `not`, `true` becomes `false`
and `false` becomes `true`, so whichever answer is chosen opens one polarity and closes the other.

TypeSafe was asked to choose between keeping it, throwing, and validating then refusing. It chose
to keep it (79%).

## Decision

The evaluator keeps answering `true` past the depth limit. The limit is a property of documents and
is enforced where documents enter: at parse, with a diagnostic. The evaluator does not police
expressions a caller built in code.

Questions the evaluator can answer without knowing the polarity of its context do decide nothing.
An unknown operator, a missing operand and a `matches` pattern that is not text all answer `false` in
their own position, because "the question was not asked" has one answer whatever surrounds it.

## Consequences

- An application that evaluates untrusted expressions without parsing them first gets no depth
  guarantee from the evaluator. It must validate them, as the parser does, before evaluating.
- A deep expression built in code still evaluates rather than being cut off.
- `matches` with a non-text pattern now answers `false`. Read as the empty pattern, it used to match
  every value.

## Alternatives rejected

- **Throw past the limit.** A condition is read on every render and on submit, so an exception there
  turns a document defect into a form that cannot render or a button that throws. The evaluator's
  other refusals were made non-throwing for exactly that reason.
- **Validate and refuse past the limit.** That duplicates the parser inside a hot path and still
  has to pick a constant for the refusal, which runs into the same polarity problem.
- **Answer `false` past the limit.** Under a `not` that opens, and the scan's concern moves rather
  than closes.

## Verification

- `packages/core/test/expression.test.mjs` ("a form's data cannot choose the regular expression"):
  a `matches` whose pattern comes from data, or is a number, answers `false` even where the data
  pattern would have matched. The test is red with the empty-pattern reading.
- The same file ("a condition deeper than the limit is refused where documents enter"): an
  expression 32 levels deep validates, and one 33 deep is refused by `validateExpression`, which the
  parser applies to every condition a document carries. That refusal is what this record relies on.

## Security and privacy

The guard against hostile depth stays at parse, where documents enter. The residual exposure is an
application that feeds untrusted expressions straight to `evaluateExpression`; the Consequences
section states that obligation. Closing `matches` on a non-text pattern removes one fail-open
answer.
