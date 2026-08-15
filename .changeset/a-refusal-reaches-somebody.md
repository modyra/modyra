---
"@modyra/core": minor
---

A refusal the server sent reaches somebody, however it is addressed

A submit action returns errors to refuse, and its argument is whatever an application derived from a
server's answer. Three ordinary shapes vanished:

```js
await form.submit(async () => [{ message: "Already registered" }]);   // no path at all
await form.submit(async () => [{ path: "", message: "…" }]);          // the form, explicitly
await form.submit(async () => ["Already registered"]);                // a bare message
// each: no error anywhere, the field still valid, the draft cleared
```

All three were dropped by the guard that drops a hostile path — `isSafeFieldPath` refuses an empty
string and refuses `undefined` — so a refusal was discarded as if it were an attack. A person pressed
Send, the server said no, and nothing appeared.

A path that is absent, `null` or `""` now means the form. A bare string is a message about the form.
A return that is not a list becomes one form-level error instead of surfacing
`errors.filter is not a function`, and the development channel says what the contract is. A message
that is not a string no longer reaches a page as `[object Object]`: it is replaced by a readable
sentence and what it held is kept on `payload`.

An unsafe path is still dropped and still reported as a security violation — that is the one case
where losing the message is the lesser harm.

A shape that used to vanish now shows a message, which may appear in a place that was previously
empty. Recorded as [ADR 0060](../docs/architecture/0060-a-refusal-reaches-somebody.md), which also
states what is left: `@modyra/plain` renders no surface for a form-level error, so on that renderer
these reach `lastSubmitErrors` and no further.
