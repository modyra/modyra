---
"@modyra/plain": patch
---

A press on a multiselect's field completes when it is released

Plain opened the list while the pointer was still down; Lit and Angular waited for the release.
Beginning a press and moving away before letting go is how a person takes a tap back, and where the
control acts on the down-event that gesture does nothing — the list is already open.

Now the press completes on release in all three, so leaving cancels it. The down-event is used only
to stop the box taking focus from the opener it is about to hand focus to.

ADR 0155 records the decision and why the release, not the press, is the half that agrees with the
button the field forwards to.
