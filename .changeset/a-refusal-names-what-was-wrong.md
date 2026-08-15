---
"@modyra/core": patch
---

A layout refusal names what was wrong, not a field that was right

Every reason a layout node could be refused arrived at the reader as one code:

```
a v3 placement in a v2 document   MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE, twice, and every
                                  name it referenced resolved
a layout nested past the cap      the same code, naming a field the document declares
a node with no `id`               the same code again
```

An author reading it went looking for a misspelled field in a document whose fields were all correct.
A refusal that names a cause the document does not have costs more than a vague one: it spends the
reader's time on the wrong file.

Each reason now carries its own code and sentence — `MDY_DYNAMIC_UNSUPPORTED_VERSION` for a construct
the declared version precedes, `MDY_DYNAMIC_INVALID_LAYOUT` for a shape or a depth, and
`MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` only for a name the document does not have.

The refusals themselves are unchanged: the same documents are refused, and only what they are told
has moved.
