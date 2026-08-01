---
"@modyra/widgets": minor
---

`compareToCanonical` compares the state, the value and the focus owner, not only the shape.

The snapshot has always collected seven fields and the comparison read three of them. A renderer
that announced a resting field as invalid, held a value no other renderer held, or parked focus
somewhere on mount produced a canonical observation that differed from every other renderer's and
passed. `MdyCanonicalExpectation` now declares all four dimensions and each reports in the
contract's words — `state is [touched], expected []`, `value is "value", expected ""`,
`focus rests on control, expected nothing`.

`MDY_CANONICAL_EMPTY` is new: the value each kind holds before anyone has given it one, in one table
every adapter's fixture reads. Milestone C compares renderers given *the same initial state*, and
three fixtures each deciding for themselves is three different questions — a number field started at
`0` is filled and valid where one started at `null` is empty and required-failing. Not derivable
from `MDY_VALUE_CONTRACTS`, which says a kind's shape and whether it is nullable: `null` and `[]`
are both legal for a multiselect and only one of them is what an untouched field holds.

Two things this found, both by renderers disagreeing rather than by reading them:

- **A required field is not a resting field.** Every kind announced itself `invalid` on mount, on all
  three renderers, before the user arrived — the fixture made every field required and empty, which
  is already failing. The contract leaves the error list's visibility to the renderer, so this is a
  policy and not a violation, but it makes "at rest" and "invalid" the same observation. The
  at-rest expectation is now measured against a field no validator has judged.
- **Two renderers seeded a text field `""` and one seeded it `null`.** The declarative Angular
  adapter starts every field at `null` whatever the kind. The fixture now states the initial value
  instead of inheriting a per-adapter default, which makes the comparison honest and leaves the
  defaults themselves as a separate question.
