---
"@modyra/core": patch
---

A field name a renderer will refuse is one the document is told about

A widget id is built from a field's name, and the renderer refuses two things in one sentence: the
id delimiter, and whitespace — both because `aria-describedby` is a space-separated list of ids, so
either one splits a reference into pieces that resolve to nothing.

The parser enforced one of them:

```
"a__b", "__b"     refused where the document is read
"a b", "a\tb"     accepted, kept, and never rendered
```

An author ran `mode: "strict"`, was told the document was fine, saved it, and the field never
appeared. Whitespace in a field name is now refused where the delimiter already was, with the same
reason — and both messages name the widget id the rule is about, so the author learns why rather than
only that.

Every other name that mounts is unaffected and measured: quotes, colons, brackets, accented letters
and a long name all associate their label and resolve their descriptions.
