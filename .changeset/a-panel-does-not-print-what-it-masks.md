---
"@modyra/core": patch
---

The devtools snapshot no longer prints what it masks

`mdyFormSnapshot` masked a sensitive field's value and carried its error messages verbatim:

```js
password: field("hunter2", [(v) => [`"${v}" is not long enough`]]);
// value:  "•••"
// errors: ['[validation] "hunter2" is not long enough']
```

Bulleted in one column, readable in the next. Quoting what was rejected is the most ordinary way to
write a validation message, and a server message is not the consumer's to rewrite at all.

A masked field's value is now taken out of every error on that field — lists and numbers included,
longest occurrence first — while the message itself is kept, because why a field is invalid is what a
panel exists to show.

A snapshot's values also go through `mdyFormSerialize` now, so a `File` reads as
`[File: name (size bytes)]` rather than as `{}`, which is what the devtools guide already promised.

Found by `battle-tests/adversarial/security/devtools-masking.battle.test.mjs`. Recorded as
[ADR 0048](https://github.com/modyra/modyra/blob/main/docs/architecture/0048-a-panel-does-not-print-what-it-masks.md).
