---
"@modyra/lit": patch
---

Two groups stop being announced as nothing, and seven English words stop being written beside the resolver

A defect planted in `fieldAccessibleName` — the published function that decides what a control is
announced as — reddened the other two renderers and left this one entirely green. Correct today, and
it would have stayed correct with the contract changed underneath, which is the third time in two days
a renderer has agreed with a rule by hand rather than read it.

Three causes, all found by making the check reach the resolver at all.

**Two groups had no name on a document that writes no caption.** `aria-labelledby` pointed at a
caption that was not rendered, which resolves to nothing — so the one case the fallback exists for is
the case nothing answered. The same shape as the two groups in the Angular renderer, and the browser
sweep that found those did not see these.

**Seven hardcoded English fallbacks in three components**, beside an i18n table that already carried
four of the words in five languages: a page in Italian announced "Choose date". They read the table
now.

**The naming the base does imperatively could not reach a control that is a button.** It looked for
an input, a select, a textarea or a combobox role — a swatch that opens a palette is none of those, so
the component wrote its own word rather than the base naming it. It asks the catalogue for the part
that opens the kind before falling back to the roles.

The check mounts each kind **without a caption**, which is the only state in which the fallback is
what a reader hears; mounted with one, every kind is named by the caption and the resolver's answer is
never reached. The shared fixture gained an option for that, defaulted to what every existing caller
already got. Planting the defect again now reddens sixteen kinds.
