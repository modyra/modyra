---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The timepicker's clock face is hidden from assistive technology, and the boxes announce the value.

The face carried `role="slider"`, `tabindex="0"` and the three values a slider needs. Every value it
can set, the hour and minute boxes can set, and they are on screen beside it — so the dial was a
second announcement of the same number, and a role a Tab walk skips is still found in browse mode,
where it promises keys it does not answer. It is now `aria-hidden="true"` with no role and no tab
stop. Click and drag are unchanged.

Nothing that was announced stops being announced. The hour and minute keep their `spinbutton` role
and bounds and gain `aria-valuetext`, so a reader hears `3 PM` rather than `3`, and `05 minutes`
rather than `5`.

**Migration.** `timepickerDialAria` is replaced by `timepickerSegmentAria(field, format, current,
period?)`. Same three values, `role: "spinbutton"` instead of `"slider"`, and an optional period that
gives a twelve-hour hour its half of the day. A caller announcing its own dial should stop: the
control that holds the value is what a reader needs to reach.

ADR 0145 records the decision, including the one case that would reverse it — a picker whose dial is
its only input must be exposed, and as options with position rather than as a slider.
