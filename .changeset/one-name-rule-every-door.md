---
"@modyra/core": patch
---

A name the contract refuses at one door is refused at every door

The name rule has three halves — a safe path segment, no id delimiter, no whitespace — and only the
flat field list applied all three. A tree child and a collection's row key were checked for the
prototype half alone, so `{ children: { "  ": … } }` parsed clean where the same name in a flat list
was dropped, and a row key like `"a b"` flattened into a path `buildFlatFormSchema` then refused —
one document, two build routes, two answers.

The whole rule now applies wherever a document names something (`isSafeDynamicName`), so which shape
an author wrote no longer decides whether their mistake is caught.
