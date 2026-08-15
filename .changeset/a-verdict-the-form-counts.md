---
"@modyra/core": major
"@modyra/plain": minor
---

A form does not send a field that says it cannot be read

A date or time a control cannot read is kept on screen and explained — and the value the field holds
is `null`, which no rule objects to unless the field is required. So the page and the form disagreed:

```
type "not a date", leave the field
  the page     aria-invalid="true", "That could not be read…", the text still there
  the form     valid, submittable
  the submit   { "when": null }
```

A server received a field left empty while the person was looking at the opposite. The submit path
was not at fault — the same field marked `required` disables the button — it was an error the verdict
could not see.

**`MdyFieldHandle` gains `reportEntry(problem)`:** a control says that what it holds does not
represent what was entered, in the words a person reads, or `null` once the two agree again. The
engine folds it into the field's errors, so `valid()`, `canSubmit()` and every error list see it.

Anything implementing `MdyFieldHandle` implements one more member — a test double, an adapter
building its own handle. Handles produced by `createForm` are unaffected.

A form that used to submit `{ when: null }` while showing an error now reports itself unsubmittable
until the entry is corrected or cleared. Recorded as
[ADR 0073](../docs/architecture/0073-a-verdict-a-person-can-see-is-one-the-form-counts.md).
