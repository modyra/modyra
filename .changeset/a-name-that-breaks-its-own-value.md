---
"@modyra/core": minor
---

A field may not be named `toString`

A form's value is an ordinary object, so a field with that name becomes a data property of it and
`ToPrimitive` is left with nothing callable: `` `${form.getValue()}` `` and `String(form.getValue())`
throw `Cannot convert object to primitive value` — in the consumer's own code, with a message naming
neither the field nor the document that declared it. `JSON.stringify` is unaffected, which is why it
went unseen.

The name is refused at the document door, where the field is dropped with a diagnostic, and at the
typed door, where it throws as other invalid names do. **This removes a capability**: a document
declaring such a field rendered before and now loses it. The migration is to rename the field; there
is no way to keep the name, because the collision is with the language.

One name rather than a list: `ToPrimitive` tries `valueOf` then `toString`, so shadowing `valueOf`
alone changes nothing and shadowing both is unreachable once `toString` is refused. See ADR 0113.
