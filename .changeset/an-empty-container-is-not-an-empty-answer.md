---
"@modyra/core": patch
---

An object with no members is not empty

ADR 0094 made an object whose every member is empty read as empty — a `daterange` before either end
is picked. The rule caught `{}` with it, and `{}` is a form root before any field exists rather than
a field nobody filled in, so the root of a form stopped reading as a value that exists.

Emptiness now needs something to be empty *of*: a value with members, all of them empty.
