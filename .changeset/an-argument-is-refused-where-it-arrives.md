---
"@modyra/core": patch
---

An argument is refused where it arrives, instead of failing somewhere else

Seven public entry points accepted a value they could not use, returned normally, and left the form
to fail on a later read with a message naming an engine internal.

```js
form.setDisabled("rows.a.code", true);   // the documented shape is () => true
form.state.valid();                      // TypeError: disabledSignal(...) is not a function
```

`setDisabled`, `setReadonly` and `setInactive` now refuse anything that is not a zero-argument
function, naming the parameter and what to wrap. `addValidators`, `upsertValidators` and
`upsertAsyncValidators` refuse anything that is not an array of functions. TypeScript declared these
parameters all along, so a typed consumer is unaffected — this is the adapter-facing surface, where a
framework's ref reaches the engine untyped.

`setValue` refuses a string, a number, `null`, `undefined` or an array: none of them is a whole form
value, and every one of them used to empty the form while `state.valid()` went on reading true. A
field the new value does not name now returns to its initial rather than to `null`, which is the rule
`reset()` already follows — `explainValueMismatch` called the old result `text cannot hold null`. A
consumer who relied on `setValue` to null a field that declares an initial must now write the null.

`setInitialValue` refuses a baseline of a different shape from the one the schema declared. An
initial is what `reset()` returns to and what `dirty` measures against, so one the field cannot hold
is a form that can never be clean and can always be reset into a value its own contract forbids.

Recorded as [ADR 0057](../docs/architecture/0057-an-argument-is-refused-where-it-arrives.md), which
states the residual gap: a field whose schema declared `null` accepts any initial, because a typed
schema carries no kind to check against.
