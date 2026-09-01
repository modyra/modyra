---
"@modyra/core": major
---

Contract v5: a document can declare a whole number

`integer` is a rule a form could be given by hand and not by document. `integer()` attaches
`step: 1`, which is what lets a number box offer whole numbers to the keyboard, so the same form
written the two ways produced two different controls.

**The word arrives with contract v5**, not with the versions already published. v2, v3 and v4 are
shipped, and adding a word to one of them changes what that version means after the fact — two
readers that both claim to support v4 would disagree about whether a v4 document carrying `integer`
is one. A v4 document is a v5 document with the version raised; `spec/dynamic-form-v5.schema.json`
is the published shape.

A document declaring `integer` under v2, v3 or v4 is refused with the version that has it:

    Unsupported dynamic form config version for "integer": it arrived with version 5,
    and this document says 4. Set "version": 5 to use it.

**Breaking:** `MdyDynamicFormParseResult.version` is now `1 | 2 | 3 | 4 | 5 | null`. A consumer
switching exhaustively over it gains an unhandled case. That surfaces as a compile error rather than
at run time, which is why it ships as a major rather than quietly.

`MDY_DYNAMIC_MEMBER_ARRIVALS` is new on `@modyra/core`: the version each member arrived with, read
by the parser to refuse a word a document predates and by the schema audit to excuse the schemas
written before it existed.

This replaces the change reverted in `3a32192c`, which added `integer` to every version at once and
was stopped by `test:contract-schema`. See ADR 0185.
