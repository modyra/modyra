---
"@modyra/lit": patch
---

A popup does not outlive the field it belongs to, and a closed option cannot be chosen

**The overlay.** A field can leave play while its popup is open, and nobody has to click anything for
it: a rule takes it out when another field changes. The widgets controllers already close their own
overlay when that happens; the Lit elements kept a second flag of their own, written only in answer
to a gesture, so the calendar stayed on screen with every cell drawn and the opener still reporting
`aria-expanded="true"` — a control that looks live and answers nothing.

The five elements that own a popup — datepicker, daterange, timepicker, multiselect and colors — now
tear it down when the field is out of play. `blocksFocus` draws the line, so a read-only field keeps
its popup: a value you may read but not rewrite is one you are still allowed to look at.

**The option.** A document can close an option — `disabled` is one of the three keys the contract's
option carries — and the native chooser a non-searchable select renders was building `<option>`
without it, so the browser let it be chosen and the value the document forbade landed in the form.
