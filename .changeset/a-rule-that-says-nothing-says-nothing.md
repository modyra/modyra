---
"@modyra/core": patch
---

A validator with no `else` no longer takes the form down with it

This is what a person writes, and it returned `undefined`:

```js
field("", [(value) => { if (value === "taken") return ["Already taken"]; }])
form.state.valid();   // TypeError: Cannot read properties of undefined (reading 'map')
```

The throw came from inside the computed every read of `valid()` goes through, so the form existed and
could not be asked anything — not its validity, not through a renderer, not by a submit — with a stack
pointing at the engine while the mistake sat in the consumer's own rule. The asynchronous half of the
same idiom failed more quietly: every good value marked invalid, with the word `"undefined"` shown
next to the field.

`undefined` and `null` now mean no messages. A bare string is one message. Anything else — a boolean,
a number, an object, or a list holding one — reports the value as unchecked and names the shape on the
development channel, rather than passing the value as though the rule had run.

`false` is read as unreadable, not as "invalid": guessing otherwise would add a second way to answer a
rule that no adapter knows about. Recorded as
[ADR 0061](../docs/architecture/0061-a-rule-that-says-nothing-says-nothing.md).
