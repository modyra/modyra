---
"@modyra/core": patch
---

The purity error names where you are, and the guide says of a validator what it said of a condition.

Writing a signal inside a computed is refused (ADR 0032), and the message said so — to someone whose
code contains no `computed`. The three places this library puts one are ordinary API surface: a
validator's body, a `when` predicate, and a field claimed while a value is being read. The error now
names them as examples, so the reader can go from the exception to the line.

`docs/guides/typed-forms.md` said a `when` predicate must be a pure function of its arguments and
said nothing of the kind about validators, which answer to the same rule. It does now — including
what to do instead (an effect that watches the field), and the property verified while writing this:
the guard leaves the form usable. The read that threw throws again while the cause is there, the
value stays readable, and the form behaves exactly as before once the write is gone.

Also fixed: a duplicated `## Async validation` heading in the same guide.
