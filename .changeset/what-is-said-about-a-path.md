---
"@modyra/core": minor
---

Disabling a section disables what is in it

A schema could put a section out of play — `group(children, { when })` takes it out of the payload
and puts it back. The imperative door could not: `setDisabled`, `setReadonly` and `setInactive`
honoured only leaves, at every level and in both kinds of collection.

```js
form.setDisabled("billing", () => !wantsBilling());
form.f.billing.iban.disabled();   // false
form.submitValue();               // billing is still in it
```

Nothing was said. Someone who wrote that had done what the documentation shows, and the first
evidence was on a server.

What a binder says about a path is now answered by every field under it — a group, a collection, a
row. The verdict is composed when a field is asked rather than pushed down when the call is made, so
a row declared *after* the sentence was spoken is covered by it too. `disabled` still wins over
`readonly` at any depth.

This is a behaviour change in the direction of the call working: code that named a container
believing it worked starts working, and code that named one by accident now sees a section leave the
payload. Recorded as
[ADR 0065](../docs/architecture/0065-what-is-said-about-a-path-is-said-about-what-is-under-it.md).
