---
"@modyra/widgets": minor
---

The contract says which catalogues live elsewhere

`MDY_CONTRACT_VOCABULARIES` lists what `@modyra/widgets` publishes, and reads to somebody scanning it
as the whole contract. It is not: what a kind *holds* — a boolean, a string, a list of options,
whether it may be null — is `MDY_VALUE_CONTRACTS`, on `@modyra/core`. A renderer author who does not
already know that has no way to learn it from here, and ends up deciding what a checkbox holds by
looking at a checkbox.

`MDY_VOCABULARIES_ELSEWHERE` names them, and `valueSlot`'s own documentation now says plainly that it
declares where a value is drawn and never what it is — the two get confused because both sound like
"the value".

**Names, not values.** A derivation must not restate what it derives, and copying core's catalogue
here would give it a second home free to drift from the first. A test imports each named package and
asks it for the named catalogue, so a rename over there fails here rather than leaving this index
pointing at nothing.
