---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A tap on the hour no longer takes the dial away

Tapping an hour handed the face over to the minutes a moment later, so a person who touched roughly
the right number and then went to drag to the one they meant found the dial already showing minutes.
The handover stole the gesture it was meant to follow.

`set-from-angle` gains `phase?: "move" | "end"`. **The hour hands over when a gesture ends after
moving, and never on a tap** — a tap is where a person starts, a release after travelling is where
they stop. A caller that reports no phase is a caller reporting a result rather than a gesture, and
gets the tap's answer: no handover.

This is a behaviour change in Plain and Lit, which advanced on a tap, and it makes all three renderers
agree. Angular did not advance at all, for a reason that was itself a defect: its clock component held
`focusedField` as a signal of its own, so the controller's handover reached the contract and never the
face. The field is now given to the clock and asked back, as `viewMode` already was — the third state
that component kept a second copy of.

**Why the reasoning is here rather than in a decision record.** `docs/` is being worked on elsewhere
and is not ours to touch this session, so this changeset carries the decision until a record can be
written for it. What is decided: a tap explores, a drag chooses, and only a choice moves the field on.

Two supporting fixes travel with it. `MdyTimepickerFieldControllerOptions` gains `emit?`, the sink for
commands the controller raises without being asked — the handover produces a `focus` command on a
timer, where there is no call for it to be returned from, so the dial drew the minutes while the caret
stayed in the hour box and an arrow moved the field nobody was looking at. And Lit's segment bound
`nothing` while it was being edited, meaning to leave the text alone; a property binding still writes,
so `value` became `undefined` and the box emptied under the caret.
