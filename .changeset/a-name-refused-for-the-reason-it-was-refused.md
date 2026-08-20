---
"@modyra/core": patch
---

A field name refused by the flat door is refused for the reason it was refused

`isSafeFieldPath` grew to refuse whitespace and the id delimiter, which closed a real asymmetry — and
made two of the three specific reasons in `assertSafeDynamicFieldNames` unreachable, because it was
asked first and its message is the catch-all:

    "a b"     said "must not be a prototype key"   the defect is a space
    "a__b"    said "must not be a prototype key"   the defect is the id delimiter

The verdict was right in every row and the reason was wrong in two, sending a reader to look for a
prototype key inside `"a b"` — and disagreeing with what the parser says about the same name, which
is the agreement `guards.ts` exists to keep.

Each reason is now asked for by name. Pollution stays first, because `__proto__` also carries the id
delimiter and the prototype chain is what matters about it; the specific reasons follow; the general
path check is last.
