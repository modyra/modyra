---
"@modyra/core": minor
---

Milestone B, batch 1: the contract says what a field holds.

`MDY_VALUE_CONTRACTS` declares, per kind, the runtime shape of the value, whether it may be absent,
and whether interaction writes through or edits a draft until confirmed. `explainValueMismatch` names
why a value does not belong in a field rather than returning a colour, and
`matchesValueShape` answers the shape question on its own.

This is the dimension the widget specification had no declaration for at all: every other one —
anatomy, semantics, relations, states — was contract data somewhere, and "what does this field hold"
was agreed implicitly by the engine, the validators and three renderers.

Implicit agreement cannot be checked, and the cost was measured. A state-matrix fixture used one
empty value for every kind, so `daterange` received `""` where two endpoints belong and was rejected
for being an empty string rather than for being an empty range — its row was green because of the
fixture. All three adapters now assert their fixtures against the declared shape, and reintroducing
that fixture fails the suite.

Two defects surfaced the moment the check ran. Every fixture drove `slider` empty as `null`, which is
a state the kind cannot be in: a thumb is always somewhere. Correcting it showed that `required`
alone can never fail on a slider, so `slider × invalid` had been green because the state was
unreachable, not because the renderers were right — the fixtures now give it a validator that can
fail. `file` was driven with `null` and `""` where an array belongs.
