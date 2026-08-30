---
"@modyra/widgets": minor
"@modyra/plain": patch
---

A role the catalogue names

Four roles were written by renderers and declared nowhere, so nothing could check them and the next
renderer had to guess.

`calendar` is a `dialog` on the datepicker and the daterange — the calendar and not the popup around
it, because the calendar is what a person enters, works in and leaves while the popup is the box that
positions it. Two renderers already wrote it there; Plain wrote it nowhere and now reads it from the
catalogue, along with the accessible name a dialog owes.

The timepicker's `hourControl` and `minuteControl` are `spinbutton`s. The projection has emitted the
role since the segments existed and the parts table did not carry it.

The conformance kit learns that `<input type="number">` is a spinbutton to the platform, so a
renderer using one carries the role without spelling it — reporting "with none" over an element that
has the role was the inspector describing its own table rather than the page.
