---
"@modyra/core": patch
---

One visit declares a row, and a record's cells are owned like an array's

Both collection managers wrote the same recursive walk — sanitizer, initial
value, validators, composed conditions, async runners — and the copies had
already drifted: only the array told the form that the row *owns* its cells, so
the sentence `MdyCollectionHost` states about ownership was true of one
collection and not the other.

Nothing in the value showed it, because the path gate refuses a removal before
ownership is consulted. That is how the difference survived, and it is why the
rule is now asserted for both kinds rather than assumed from one.

The walk lives in `collections/register.ts`, recursive over a row's shape, with
what to do about a collection inside a row handed in by the caller — the part
the two kinds do not share, and the part still being built.
