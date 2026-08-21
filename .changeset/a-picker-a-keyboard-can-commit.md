---
"@modyra/widgets": major
---

Tab moves inside a popup that has controls of its own

`Tab` was declared as `cancel` for every kind with an overlay. A timepicker's popup holds six
controls, so:

> Open the picker, type an hour, press `Tab` to reach the minutes — the picker closes and the draft
> is discarded.

And nothing else reached the confirm button, so **the widget's only way to commit a time was a
pointer**. WCAG 2.1.1, not a preference.

**Migration.** `Tab@open:cancel` is withdrawn for `timepicker` and `Tab@open:move` declared in its
place. Every other overlay kind is unchanged — a popup holding a list is one composite control and Tab
leaving it is the combobox pattern. The question is asked of the catalogue: a kind that declares an
`actions` bar keeps Tab, because an action bar means a confirm button inside the overlay.

A renderer built against the old table and not updated leaves a timepicker popup open when the user
tabs. `Escape` is unchanged, still cancels, still returns focus to the opener — and is now the only
way out of the dialog, which is why it stays.

Three things are published with it, so the renderers stop each answering them: `timepickerTabOrder`
(hour, minute, period on a twelve-hour picker, mode toggle, actions — wrapping at both ends),
`timepickerFocusPart` (which part carries focus for a field), and `MDY_TIMEPICKER_ADVANCE_MS` (one
delay for the dial's hour→minute handover, where there were three: 0, 200 and 300).

ADR 0122 records the decision and amends ADR 0021, which had declared Escape and Tab equivalent.
