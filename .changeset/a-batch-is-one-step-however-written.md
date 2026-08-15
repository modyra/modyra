---
"@modyra/core": patch
---

`mutate` refuses a callback that has not finished

`mutate` exists for one promise — one history entry, not three — and it keeps it under every shape a
batch takes, except one:

```js
form.mutate(async () => { set(a); await …; set(b); await …; set(c); });
// three undo steps, nothing said
```

The batch closes when the synchronous part ends, so every write after the first `await` lands outside
it and the caller gets exactly the history `mutate` exists to prevent. TypeScript does not stop it: a
function returning `Promise<void>` is assignable where `void` is expected. And nothing on the calling
side can see it — `mutate` returns `void`, so awaiting it waits for nothing, and the only symptom is
counting undo steps.

A callback that returns a thenable is now refused, at the call. The check reads the **return value**
rather than a thrown error, because an async function that fails after an `await` does not raise —
it returns a rejected promise, which is the same reason the defect is invisible to whoever writes it.

Every other shape is unchanged: nested `mutate` still collapses into the outermost, a callback that
throws still keeps the write it made before throwing, and a callback that changes nothing still
records no entry.
