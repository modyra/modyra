---
"@modyra/widgets": minor
---

The seven presence conditions that were owed an answer have one

`valueIsPresent`, `valueIsAbsent`, `fieldIsRequired`, `undoIsOnOffer`, `viewIsActive`,
`inputWasRefused` and `workIsInFlight`. Each takes the narrowest input that decides it rather than a
widget state, because a resolver that takes everything is one a caller cannot use without holding
everything.

**`valueIsPresent` is derived, not tabulated.** The emptiness of a value is the kind's, and the kind
declares it: `nullable` separates a number field whose empty is `null` from a slider whose empty is
where it starts, and the shape separates a list from the single value it holds. `Boolean(value)` gets
both wrong, and three renderers asking it separately got them wrong in three ways — which is how this
condition came to mean one thing where chips are drawn and another where they are not.

It refuses one case rather than guessing: a non-nullable numeric value has no absent state and this
function is not handed the floor. A check asserts no kind of that shape declares a part under the
condition, so the branch is unreachable rather than wrong — and if one ever does, that check fails
instead of the rule quietly answering for a slider at its minimum.

**`fieldIsRequired` is not `handle.required()`.** A marker on a field nobody can fill in asks for
something that cannot be given, and the asterisk that means "you must" on a live field still reads as
a demand on a disabled one.

**`workIsInFlight` is two facts and one question** — a validator that has not answered and a list of
options still arriving. A renderer asking them separately shows the waiting part for one of the two
reasons it exists.

The rule is checked against `MDY_CANONICAL_EMPTY`, the table every adapter's conformance fixture
mounts from: what the fixtures call empty, the rule calls absent, and what they call filled it calls
present. Two statements of one rule is the shape this work has been removing; where one cannot yet be
deleted, the next best thing is that they cannot drift apart in silence.

`MDY_PRESENCE_RESOLUTION` now names an answer for eleven of the fourteen conditions and an argument
for the three that will never owe one. `owed` stays in the shape with nothing in it, because a
condition added to the contract arrives owed and the table has to be able to say so.
