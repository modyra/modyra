---
"@modyra/core": patch
---

A value the draft cannot read does not take the form down

Deciding whether a value may be stored walked it with `Object.values`, which *reads* every member —
so a field holding an object with a throwing getter raised out of the debounced write, from a timer
nobody is awaiting, and took the form with it.

The walk reads keys and takes each member in a guard. A member it cannot read is a member it cannot
store either, so it answers the question the same way a `File` does: this value is not written to the
draft.
