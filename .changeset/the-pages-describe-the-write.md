---
"@modyra/core": patch
---

The guides describe the whole-value write the engine performs

ADR 0057 changed what `setValue` does with a field the passed object does not name — it goes back to
its **initial** rather than to `null` — and said so in its own consequences. Two published guides went
on saying the old thing:

```
docs/guides/troubleshooting.md   "fields absent from the passed object are reset to `null`"
docs/guides/typed-forms.md       "schema fields absent from `v` are reset to `null`"
```

The troubleshooting one costs more, because it sits under *"Why did my value reset to null after
`setValue()`?"* — a person reads it while already confused, is told to look for a `null`, and finds
the field's initial.

Both now describe the write that happens, and both mention the other half of the same decision: a
whole value naming none of the form's fields is refused rather than obeyed.
