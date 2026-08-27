---
"@modyra/widgets": minor
---

Type-ahead is declared, with a key that admits it has no key

All three renderers let you type a letter at an open list to jump to the option beginning with it,
and none of them was asked to: the contract had no binding for a printable character. A check
counting what a renderer claims against what the contract declares read this as a renderer doing more
than it was told. It was the contract doing less.

Declaring it needed a key, and there is none — the gesture is *any* character. Picking a letter to
stand for the alphabet would be a table saying one thing and intending another, which a tool reads
literally and a person reads charitably. `MDY_ANY_PRINTABLE_KEY` is the key field admitting it has no
key, and `keyBindingFor` resolves any single character to it.

Narrower than "navigates options": only kinds that hold a list of named choices. A calendar walks its
cells with the arrows and has nothing to type at — a date is not a word, and a character typed there
reaches the platform rather than being swallowed. Keyed on the part that *is* the list rather than on
a role, because the two kinds that have one give it different roles — a listbox where choices are
exclusive, a group where they are not — so a role test covers one and misses the other while looking
like it covers both.

Space is never a character to search with, a closed list has nothing to jump within, and a named key
still wins where both could answer.
