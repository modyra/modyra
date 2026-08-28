---
"@modyra/widgets": minor
---

A control is described by its error **and** its help, error first

The rule was `errorsVisible ? errorId : descriptionId` — one or the other. So the moment a field
failed, the instruction that would have prevented the failure stopped being announced, at the one
moment it was most useful. A description is a list; both fit in it. The error is named first because
it is the new thing, and somebody who stops after the first sentence has heard the one that mattered.

`MdyFieldShellA11yOptions` gains `errorsReserved`: whether the error container is **on the page**,
which is not the same question as whether it holds a message. A renderer that keeps the container
under every field that can fail a rule passes this and keeps one reference that never changes — and a
reference that never changes has no moment at which it can point at an element not yet drawn, or one
already gone. That is a class of dangling reference removed rather than corrected.

An element with no text contributes nothing to a description. It is not read as a pause or as
"empty"; it is as though the reference were absent, until text appears inside it. Which is what makes
a permanently-present reference cheaper than a carefully-maintained one.

`errorsReserved` defaults to `errorsVisible`, so a renderer that draws the container only when it has
something to say is unaffected. `fieldDescribedBy` is exported as the one place the composition
lives.

**No renderer reserves the container yet.** Reserving it in lit turned two things red that this
change does not settle: the contract orders `errors` after `supportingText`, and two kinds render
them the other way round; and a reference claimed before the renderer draws the container dangles.
Both are renderer work, and both are the reason the projection lands first.
