---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Honour the view key in all three renderers, and stop a held arrow moving a day

The previous release declared the gesture that steps between a calendar's views and said the
renderers would honour it next. This is that one: the accelerator with the vertical arrows now walks
days → months → years and back, in plain, Lit and Angular, and the keyboard goes with it. ADR 0199.

`calendarViewOnZoom` is the new declaration — where a step along the funnel lands, clamped at both
ends rather than wrapped, because a ring would send a held key from the widest view straight back to
the narrowest and oscillate there. It is a different journey from `calendarViewOnToggle`, which is
the header's shortcut to the top, and the two are kept apart deliberately.

**A defect the previous release introduced, repaired here.** Both calendar controllers refused a
press carrying the accelerator with the condition "held *and* nothing is declared". That held only
while no binding claimed a held arrow. Declaring one made the press stop being refused and fall
through to the movement below, which reads the key name and never the modifier — so the accelerator
moved a day as well as changing the view. The condition is now "held at all", which is what the
calendar means: none of the keys that walk it is declared with a modifier, and a dismissal is
answered first because it declares that it survives anything held with it. Angular's own local
movement path had the same gap and is closed the same way.

**And a landing that was never needed before.** Lit and Angular only ever moved focus into the days
view, because the months and years were reachable only by clicking the header — which leaves focus on
the header button. With a key that steps the view, that left a person zooming out and finding the
keyboard on a cell the render had just taken away. Both now land in the view they reach.
