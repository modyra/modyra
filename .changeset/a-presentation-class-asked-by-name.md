---
"@modyra/widgets": major
---

Presentation classes are keyed, and asked for by name

`MdyWidgetDefinition.presentationClasses` was `readonly string[]` and is now
`Readonly<Record<string, string>>`, with `presentationClass(kind, name)` to read it.

**Migration: you were reading by index, now you ask by name.** `contract.presentationClasses[0]`
becomes `presentationClass(kind, "box")`. Every entry has a key that says what the class is.

Why it could not stay a list: fifty-two classes across nine kinds were declared and unreachable. A
renderer wanting one had to take a position out of an array it did not write, so an insertion
anywhere moved every answer after it — which is the reason no renderer asked, and a hundred and nine
class names stayed spelled by hand in the three that ship.

A name the kind does not declare is refused, with the names it has. An empty string would have put
an unclassed element on the page with no complaint.
