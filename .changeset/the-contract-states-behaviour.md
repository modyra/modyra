---
"@modyra/widgets": minor
---

The state contract says what a state *does*, not only what it renders

`MDY_WIDGET_STATE_CONTRACTS` described attributes and parts. That is enough to catch a renderer that
forgets `aria-disabled`, and useless against the defect that actually shipped: `disabled` and
`readonly` rendered differently and behaved identically — both submitted, both validated — and
nothing about the markup was wrong.

Each state may now declare a `behaviour`: whether a field in it is `submitted`, `validated`, and
`reachable`. `disabled` is none of the three; `readonly` is all of them.

The declaration is checked against the engine that implements it, so it cannot drift into being a
comment with a type on it.
