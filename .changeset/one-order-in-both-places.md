---
"@modyra/core": patch
---

A keyed collection keeps one declaration order. Two operations move a key without adding or removing
one — an undo that puts a row back where it was, and a rename that gives a row the old key's place —
and both wrote the new order into the list `keys()` reports while the declared set kept the order the
keys were first declared in. The set is what a whole-value write and the value itself read, so a form
looked correct until the next `setAll`, which restored an order the user had already undone —
arbitrarily far from the operation that caused it. `keys()` remains the only surface that can answer
the question at all: a value is a plain object, and JavaScript puts an integer-like key first however
it was written.
