---
"@modyra/lit": patch
---

A popup that hears the keyboard leave

Four of lit's overlay kinds declare `dismissOnFocusOutside` and `Tab@open:cancel` and honoured
neither. A calendar opened from the keyboard stayed open behind the field a person moved on to — and
because it stayed open, the next control's own keys reached the dialog instead of the control being
looked at. One left-open popup was enough to make a timepicker look like it could not be opened from
the keyboard at all, which is how the two findings turned out to be one.

Both halves are read from the contract rather than written per kind:

- **Focus leaving the element closes it**, where `capabilities.dismissOnFocusOutside` says so.
- **Tab closes it**, where the keyboard table says `Tab@open:cancel` — without `preventDefault`,
  because Tab is already carrying the keyboard onward and pulling it back would trap a person in the
  field they just left.

Focus-out alone could not have done it: these popups render **inside** the element, so Tab from the
trigger moves into the popup and never crosses the boundary a `focusout` reports.
