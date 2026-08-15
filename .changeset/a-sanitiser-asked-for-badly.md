---
"@modyra/core": patch
---

A sanitizer asked for badly is refused, not silently the one that does nothing

`sanitize` defaults to `"off"`, deliberately — and that default made every way of getting the option
wrong indistinguishable from not having asked for it:

```js
createForm(schema, { security: { sanitise: "strict" } });  // the British spelling
createForm(schema, { security: { sanitize: "stict" } });   // a typo in the value
field("", [], { sanitize: "stict" });                      // the same, per field
// markup kept, nothing said, an XSS defence off
```

The profile names are a closed set, so a member outside it is not a preference — it is a request for
something that does not exist, answered with the least protective member of the set.

A profile that is not one of `off`, `text`, `strict` or a function is now refused, naming what was
asked for, at the form and at the field alike. `security` refuses a key it does not have, and an
option the form does not read — `{ sanitize: "strict" }` written at the top level instead of inside
`security` — is reported on the development channel.

Not sanitizing by default is unchanged: a consumer who asks for nothing still gets nothing. What is
refused is asking for something that does not exist.
