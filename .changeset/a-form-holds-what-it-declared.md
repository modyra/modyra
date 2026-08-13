---
"@modyra/core": patch
---

A key the schema never declared cannot enter a typed form

Three lines of public API were enough to make a form unable to say what it would submit:

```js
const form = createForm({ name: field("") });
form.patch({ evil: 1 });
form.submitValue(); // threw: [modyra] Flat patch does not match schema shape
```

`patch()` takes whatever a consumer received, and an undeclared member became a field. `getValue()`
then answered with a key outside `MdyFormValue<S>` — the shape its type promises — and the next
`submitValue()` threw on the shape check, permanently.

The same key arrives through a restored draft, which is the door that matters: the default draft
storage is `localStorage`, plain text and writable by every script on the origin, so a form could be
bricked, and `fieldNames()` given a name of the writer's choosing, by data at rest. A
document-driven renderer draws from `fieldNames()`.

Both doors now hold the schema's line. A patch keeps only the members the schema describes, as
`setValue()` always has. A draft restores only what the form declares — a field it owns, or a path
inside one of its collections, so a restored order still gets its lines back. Used without a schema,
the engine still lets a draft create fields; that is what an undeclared form is for.
