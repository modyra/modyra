---
"@modyra/core": patch
---

A server is asked only about a value the field's own rules accept

Typing a tax id one group at a time — `minLength(11)`, a pause between groups — sent four requests,
for `""`, `"I"`, `"IT"` and `"IT1"`. The form already knew all four were too short to be a tax id,
and asked anyway.

The debounce is not the answer: it limits how *often* a settled value is sent, and a settled prefix is
still a prefix. `when` could suppress them, and doing so means restating in a second predicate what
the field has already declared — two truths that drift in silence the moment `minLength` changes.

An async validator now runs only when the field's own synchronous rules accept the value. It is the
rule Angular's `AbstractControl` follows and the one line missing from the comparison table, so a
consumer arriving from there brings the assumption with them.

A field whose value its own rules refuse reports nothing pending and holds no stale async verdict —
an answer about a value that is no longer there is not an answer about this one. A visible
consequence: an empty required field shows no spinner, because no check is running.
