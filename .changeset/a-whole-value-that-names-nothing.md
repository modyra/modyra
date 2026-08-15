---
"@modyra/core": patch
---

A whole value that names none of the form's fields is refused, not obeyed

`setValue` refuses a string, a number, `null`, `undefined` and an array. An object was the one shape
it let through, and a wrong-shaped response is an object:

```js
form.setValue({ emial: "x" });   // one transposed letter
form.getValue();                 // every field back to its initial
form.state.valid();              // true
```

The rule that a field the value does not name returns to its initial then emptied the form, silently,
with nothing said on either channel — which is the erasure the argument check was written to close.

A whole value naming none of the form's fields now throws, and names the keys it did not recognise.
`setValue({})` is unchanged: it is the spelling for emptying a form deliberately, and it is what a
caller who means that writes. A value naming some of them writes those and reports the rest on the
development channel, because a server that renamed one field is the ordinary way this happens.

Recorded as an amendment to
[ADR 0057](../docs/architecture/0057-an-argument-is-refused-where-it-arrives.md), whose Security
section claimed a protection the decision did not yet deliver.
