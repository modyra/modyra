---
"@modyra/core": patch
---

A declaration that raises while it is read leaves nothing behind

A row's value is not always plain data. An ORM entity behind a lazy association, or a proxy over a
store, raises when a column nobody loaded is read — and the key was committed to the collection
before the row's fields were registered, so a caller who caught that error was left with two public
reads disagreeing:

```js
form.f.rows.upsert("bad", { get code() { throw new Error("not loaded"); } }); // throws
form.f.rows.keys();     // ["ok", "bad"]
form.getValue().rows;   // { ok: … }   — "bad" is not there
```

A positional collection said it twice as plainly: `length()` counted the row, the value did not have
it.

A declaration is atomic now. If reading the value raises, a key that was new is withdrawn and a list
goes back to the rows it had, then the error is rethrown — a rewrite of an existing row already left
the row it was rewriting, and that is now the rule for all of them.

Two things decided alongside, both previously unstated:

- **A row reads the object it was given, prototype chain included.** A class instance or an ORM
  entity keeps cells on its prototype, and a row built from one has to see them. Untrusted shapes
  enter through other doors — a document, a draft, a patch — which are filtered to the paths the
  schema declares.
- **A polluted `Object.prototype` no longer answers for a schema.** The normaliser read its
  accumulator through the prototype chain, so `Object.prototype.note` set by anything else on the
  page made `createForm({ note: field("") })` fail with `Schema key "note" is declared twice` — a
  message naming a defect in a schema that had none.
