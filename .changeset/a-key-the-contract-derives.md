---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Two different choices held at once stop arriving as one.

With option values that are objects — `{ id: 1, name: "Alfa" }` and `{ id: 2, name: "Beta" }`, both
chosen — every renderer drew **one** chip, labelled as the first taken twice, with the counter
agreeing. Beta did not appear as missing; it appeared as more Alfa. A person read a field asserting
something they had not chosen.

Each renderer spelled the key derivation again as `String(value)`, which renders every plain object as
`[object Object]`, so two distinct values collapsed into one key. They read `defaultOptionKey` now —
the same function the controller derives its own keys with, which keys an object by what it holds.

**Nothing moves for a primitive**: `defaultOptionKey(v)` and `String(v)` agree exactly there, which is
also why no fixture in the suite could see this — all of them hold strings.

Two label fallbacks go with it: lit matched a held value by identity alone and fell through to
`[object Object]` for a fresh object that *is* an option's value, and Angular labelled a value whose
option had gone with the same string. Both name what the value holds instead.
