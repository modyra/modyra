---
"@modyra/widgets": minor
"@modyra/vue": minor
---

A kind declares the faces it can wear, and both are read

A **variant** changes a widget's anatomy — which parts exist. A **face** leaves the anatomy alone and
changes what the parts say: a clock drawn as twelve hours and one drawn as twenty-four hold the same
instant, draw the same boxes, and put different numbers in them. Only the first was declared, so a
suite that mounted one face reported full coverage having read half the widget.

`capabilities.faces` names them per kind, with the value that tells them apart. Most values cannot:
ten in the morning is `10` on either clock, and a walk holding one of those has mounted the same
widget twice and counted two passes. The separating value is declared with the axis rather than
chosen by whoever is looking — `timepicker` declares `format: { values: ["12h", "24h"],
toldApartBy: "14:05" }`.

The conformance kit reads it. For every face a kind declares it mounts, holds the separating value,
and asks two things: that the number a control shows is the number it announces, and that the faces
do not all read alike. The second is what the separating value buys — a renderer told to wear one
face and drawing another passes every check made inside a single mount, because both halves of it
agree and both are the wrong face.

**`@modyra/vue` — a timepicker can be told which clock to draw.** It could not before: the component
declared no `format` prop and never passed one on, so a document asking for a twenty-four-hour clock
got a twelve-hour one in this renderer and no other. Its hour box also drew the draft directly, which
is held canonically as 1–12 with a period whatever face the field wears; it now draws the number the
contract announces, so what is shown and what is read out cannot drift apart.

**On the classification.** The type-surface audit reports this `major`; it is released as `minor`,
and both belong in the record.

Adding an optional prop whose default is `undefined` is additive: no existing call breaks, and there
is no migration to perform. The audit reports `major` because the component's whole inferred props
type is re-printed and it compares by name — the case it documents as reported "for caution rather
than from evidence". That is the right answer for a tool with no type checker behind it, but it is a
statement of what the tool cannot see rather than a finding about this change. Where the audit
declares itself outside its perimeter and the change carries its own evidence, the classification is
decided by a reader; where the verdict has a defensible core, the verdict wins.
