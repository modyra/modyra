# ADR 0094: One question about emptiness, one answer

Status: Accepted

## Context

A form asks *has this field been answered?* in two spellings: `required`, which refuses an empty
value, and `isEmpty`, which a condition reads. They disagreed, and the disagreement was written down
as a decision — `expression.ts` said *"`0` and `false` are not empty, because they are answers"* —
while `MDY_VALUE_CONTRACTS` said the opposite for two of the kinds.

```
kind        empty                   required refuses it   isEmpty called it empty
text        ""                      yes                   yes
number      null                    yes                   yes
slider      0                       no                    no      ← the declared agreement
checkbox    false                   yes                   NO
toggle      false                   yes                   NO
daterange   {start:null,end:null}   yes                   NO
```

The slider is what makes the other three defects rather than differences: a thumb is always
somewhere, so an untouched slider reads as *filled* — and **both halves say so**. Where the contract
had decided, the two agreed; where it had not, they diverged.

Measured end to end on a consent checkbox nobody had ticked: the form refused to submit, saying
*This field is required*, while a rule reading `isNotEmpty` on the same box in the same instant
revealed the section it guarded. The rule failed in the direction that opens — a section meant to
appear *after* an answer appeared before it.

## Decision

Emptiness is what the kind's value contract calls its empty, and both spellings read it.

- `false` is empty. A checkbox's contract says absence is not one of its values, so "not ticked" is
  the only way that field can say *nothing yet*, and `required` already refuses it.
- An object whose every member is empty is empty — a `daterange` before either end is picked.
- `0` stays an answer. That is the agreement the rest was made to match, not an exception to it.

`required` does not move. A mandatory consent that stops a submit is the case the whole feature
exists for, and weakening it to reach agreement would trade a real protection for a symmetry.

## Consequences

**A rule already written over a boolean changes meaning**: `isNotEmpty` on a checkbox now means *is
ticked* rather than *is a boolean*, which is what an author writing it meant, and what a form that
refuses the same value already believed. A document relying on the old reading — a rule that fired
for every boolean regardless of its state — stops firing when the box is clear. That is the repair.

`isEmpty` now walks an object's members, so a condition over a group or a collection row answers
about what is inside it rather than about the container being an object. The walk is over own
enumerable values only.

An object with **no** members is not empty. A container that declares nothing says nothing about
answers — `{}` is a form root before any field exists, not a field nobody filled in — and reading it
as empty took the root of a form out of `isNotEmpty`, which
`battle-tests/adversarial/security/expression-paths.battle.test.mjs` holds. A `daterange` always
carries its two members, so the case this record is about is unaffected.

## Alternatives rejected

**Move `required` instead.** A required checkbox would stop blocking the submit, which is the one
thing a consent box is for.

**Leave both and document the difference.** It *was* documented, in the sentence quoted above, and
the documentation is what made it survive: two published spellings of one question that answer
differently is not a nuance a reader can be expected to carry.

**Teach `isEmpty` the kind.** It reads a value, not a field; passing a kind into every condition
would put the vocabulary of the catalogue into the expression language, which is the coupling
ADR 0092 exists to avoid.

## Verification

`battle-tests/adversarial/validation/two-ideas-of-empty.battle.test.mjs` — *the validator and the
condition agree about what empty means* — across the kinds, with the slider as the control that the
agreement is a real agreement rather than both halves being blind.

## Security and privacy

The failing direction was the dangerous one: a section a rule was written to reveal only after an
answer was shown before it, and the values inside it went into the payload. Nothing here changes what
is stored or sent beyond that; a rule that now fires less often reveals less.
