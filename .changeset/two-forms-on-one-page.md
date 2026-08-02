---
"@modyra/plain": minor
---

`mountMdyForm` takes an `idPrefix`, so two forms can share a page.

Every id a form generates derives from the widget id, and the widget id was the field name alone.
Two forms built from the same field names therefore minted the same ids, and the second form's
`label[for]`, `aria-describedby` and `aria-errormessage` all resolved to the **first** form's
elements. Neither form examined alone looked wrong, which is why the whole suite was green: the
defect only exists on a page holding both. The radio group's `name` collided the same way, so two
radio groups merged into one and selecting in the second cleared the first.

```ts
mountMdyForm(host, fields);                        // ids unchanged: `email`, `email__label`
mountMdyForm(other, fields, { idPrefix: "quote" }); // `quote-email`, `quote-email__label`
```

Additive. Unset — the default — leaves every generated id byte-identical, and the same option is
what makes ids deterministic across a server and a client that agree on the prefix.

Two rules are enforced where the form is built rather than discovered as a duplicate id somewhere
in the document: the prefix may not contain `__`, which separates the segments of a generated id,
and it may not contain `-`, which joins it to the field name. The second is what makes two distinct
prefixes provably unable to collide — the joiner's first occurrence always ends the prefix, so
`"a" + "b-c"` and `"a-b" + "c"` cannot both produce `a-b-c`.

`renderField` and each `render*Field` take the widget id as a new trailing optional argument,
defaulting to the field name. Existing calls are unaffected.
