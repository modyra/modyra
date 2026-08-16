---
"@modyra/core": patch
---

An initial value is checked where the document declares it

A collection's initial was measured against its own shape — a record wants an object, an array a list,
each refused by name — and a field's was measured against nothing. `{ kind: "text", initialValue: 42 }`
passed in the strictest mode there is and produced a form that was invalid before anybody touched it:
`{"a": 42}`, `valid: false`, *"This field holds string"* on a value the user never entered and cannot
see how to correct.

The knowledge was already published and used one layer later — `explainValueMismatch` is the sentence
the engine says about a value that arrives at runtime, and a declared initial is that value arriving
earlier. Both parser doors now say it: the flat field list and the schema tree.

`buildDynamicFormSchema` drops an initial its kind cannot hold and names it in a development warning,
starting the field from the kind's own empty value. Dropped rather than thrown: a form is the thing a
person is looking at, and refusing to build one takes the whole page away.
