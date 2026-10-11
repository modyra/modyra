---
"@modyra/vue": patch
---

A Vue field draws the marks at its end, and its commands answer the keyboard

The affordances the catalogue declares at a field's inline end were empty boxes in this renderer:
the arrow of a chooser, the calendar on a date or range opener, the clock on a time opener and the
caret on a colour field. They now carry the same `MDY_ICONS` geometry the other renderers draw. So
do the multiselect's arrow, its clear-all and the one-fewer and one-more steppers on chips and list
entries, which painted nothing a person could find.

Enter and Space pressed on a chip's remove, the clear-all or the way back opened the list and were
consumed, so the button never acted. The field now leaves those keys to any button that is not its
trigger, and the way back's shortcut still answers from anywhere in the field.

The multiselect now draws the count of chips the strip cannot show ("+3", announced as "3 more not
shown"), measured from the laid-out row. Pressing it opens the list.

No migration.
