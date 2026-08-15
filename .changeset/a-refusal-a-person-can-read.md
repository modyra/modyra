---
"@modyra/core": patch
---

A refusal names the choices in the words the person can see

`oneOf` builds the sentence a rejected choice reads, and it built it out of the values:

```js
oneOf([{ id: 1, label: "One" }, { id: 2, label: "Two" }])
// "Value must be one of: [object Object], [object Object]"

oneOf([])   // "Value must be one of: "   — a sentence that ends at its colon
```

Object options are ordinary — a domain writes `{ id, label }`, and the value contracts admit them —
so the first told a person their choice was not among two things it did not name. The second is the
restored-draft case: a saved choice measured against a list that has not arrived yet, refused
correctly and explained with nothing after the colon.

A field compiled from a document now names its options by their **labels**, which is what the person
can match against the list in front of them. `oneOf` and `eachOneOf` render an object option as what
it holds rather than as `[object Object]`, and an empty list says `There are no choices to pick from.`
instead of trailing off.

`oneOf(values, message)` is untouched: a caller with better words keeps them.
