---
"@modyra/vue": patch
---

A field that announces it must be filled draws the mark that says so

Every kind declares a `requiredMarker` inside its caption, present when the field is required. Vue
drew it on none of the seventeen: a reader was told `aria-required="true"` and nobody looking at the
page could see it. The two are one statement about one field.

Composed once, in a caption helper, from the same door the control's announcement comes from — a
caption that decided for itself whether the field was required would be a second reading of the rule,
free to drift from the first. The field is asked as a whole rather than for its `required` flag
alone, because a field out of play cannot be filled in and the mark is not owed of it.

**The conformance kit reported vue CONFORMANT throughout.** `requiredMarker` is declared
`presentWhen: "fieldIsRequired"`, and the kit's structure walk decides what a part owes from
`optional` and `variant` only — a part gated on a condition has no reader, so a renderer can omit one
for the life of the feature and stay conformant. That gap is the subject of separate work; this notes
that the defect was found by measuring rather than by any check failing.

Vue's conformance config also silently dropped `validators`, so the not-required state was
unreachable in it: the fixture answered `required` to every mount, and a first reading of these
numbers accused the renderer of announcing `aria-required` on a field nobody must fill. It was the
bench that had never been put in the other state. The config now names the argument.
