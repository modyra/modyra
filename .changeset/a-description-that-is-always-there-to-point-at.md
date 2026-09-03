---
"@modyra/angular": major
---

Draw the description element always, and read it before the errors

Two changes that are one act: the second is only measurable because of the first.

**The element.** A field's description was rendered only once it had words, and its id was withheld
with it. The contract's projections name `<field>__description` whenever they describe a control, so
that id has to exist for the reference to land — an `aria-describedby` pointing at nothing does not
degrade to no description, it removes one the reader was promised. The element is now drawn on every
field, carrying its id, `hidden` when it has nothing to say. Which is exactly what the other two
renderers have always done.

The two halves stay apart, deliberately: the element exists so a reference can land, and
`describedById` still decides whether making the reference is worth a reader's move. A control that
names an empty description sends someone to hear nothing and teaches them not to follow the next one.

**The order.** With both on the page for the first time, the reading order could be measured — and it
was wrong on all seventeen kinds. The contract declares `supportingText` before `errors`; Angular
drew the error list first. It now reads as declared: the instruction, then what went wrong. You read
what to do before you read what failed, and anyone using `aria-describedby` hears them in that order
anyway.

**What changes for someone looking**: on a field showing supporting text and errors together, the
supporting text is now above the error list. No screenshot baseline moves — the photographed
renderers are plain and lit, and both already read in this order.

**What changes for someone listening**: every field's description is addressable, so the projections
that name it resolve; controls whose projected description previously pointed at nothing now describe
themselves.

**Migration.** `descriptionId` on `MdyBaseControl` returns `string` rather than `string | null`, and
the multiselect's override of it is gone — the base no longer withholds the id, which is what that
override existed to work around. Both are `protected`: a subclass that overrode the method with the
nullable signature has to widen it, and one that only calls it is unaffected.

Four pre-existing defects were found by measuring in this worksite, every one invisible until the
missing element existed: the caption's id, the timepicker's dangling reference, the caption on two
kinds, and this order.
