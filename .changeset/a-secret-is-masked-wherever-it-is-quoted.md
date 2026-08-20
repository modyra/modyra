---
"@modyra/core": patch
---

A `sensitive` field's value is masked in its messages too, whatever shape the value has

`mdyFormSnapshot` masks a `sensitive` field's value and removes it from that field's messages —
masking a value and reprinting it in the next column does not mask it. It collected the literals to
remove from strings, numbers, bigints and arrays, and a form value can also be an **object**, in
which case it collected nothing:

    a string            rejected "•••"                                  masked
    an object           rejected {"start":"hunter2…","end":"hunter2…"}   PRINTED
    an object in a list rejected [{"pan":"hunter2…"}]                    PRINTED

This reaches shipped kinds with no custom validator: a `daterange` holds `{ start, end }` and its own
contract check quotes the end it could not read; `file` holds descriptors and `multiselect` may hold
object option values. The value column and the errors column of one row disagreed about whether a
value is a secret.

Objects are walked now, values only and never keys — a masked key would make every message naming the
field unreadable — with the existing longest-first ordering kept so a value containing another leaves
no fragment behind, and a cycle guard so a self-referential value cannot hang the panel.
