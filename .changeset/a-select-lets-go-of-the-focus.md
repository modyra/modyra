---
"@modyra/widgets": patch
---

A select that closes on blur lets go of the focus.

`blur` closed with `restoreFocus: true`, so leaving an open select pulled focus back to its own
trigger — off whatever the user had just clicked or tabbed onto. The pointer path in the same
renderer closed with `restoreFocus: false`, so the two disagreed and which one ran decided where
focus ended up.

The arrow followed from the same event: it carries the `open` state and animates its rotation, and a
trigger regaining `:focus` a tick after the rotation starts is what made the close look like it
stuttered.

`Escape` still restores focus, and deliberately: there the user is still in the widget and has
nowhere else to be. `touched` is unchanged.

The colour field never had this: it is the one overlay field with no focus path at all, so it has a
single dismissal rule and nothing to disagree with.
