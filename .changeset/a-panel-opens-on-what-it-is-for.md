---
"@modyra/widgets": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

Open a panel on the thing it was opened to operate

`focusPartOnOpen(kind, { searchable })` says which part takes focus when a widget's panel opens: the
filter box where there is one, the first option where there is not, a day for the two calendars, the
hour for a timepicker, a swatch for a colours field.

**For five kinds this is a declaration, not a change.** Select, datepicker, daterange, timepicker and
colours already answered this way in all three renderers, each privately, and the checks that now
assert it passed the moment they were written. Nothing moved to make them conform.

**The multiselect had three answers**, measured in the same configuration each time: the filter box in
one renderer, the trigger in another, and the trigger again in a third when there was no filter box.
Both are patterns a combobox may follow, which is why it survived — every renderer was defensible
alone and no two agreed. So a person met different muscle memory depending on which adapter their
team had chosen.

**What changes for someone using a keyboard**: opening a multiselect in Lit now puts focus inside the
panel rather than leaving it on the trigger, and the same in Angular for a multiselect without a
filter box. The options are reachable with no extra press, in every renderer. Not the chip — that is
the control that *removes* a choice, and landing there when you asked to add one is the right element
at the wrong moment. ADR 0197.

Lit's `toggleOpen` overrode the base without calling it, so the hook the base fires on opening never
ran; it now does. That is why the panel could open with nothing told about it.
