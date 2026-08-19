---
"@modyra/widgets": patch
---

An option list carrying an inherited name — `__proto__`, `constructor` — draws. The per-option
parts a controller publishes were accumulated in a plain object, so assigning the part for an option
valued `__proto__` set that object's prototype instead of adding a member: the part vanished, the
renderer was handed `undefined`, and the control disappeared from the page mid-draw with an uncaught
error in an effect. The accumulator has no prototype for such a name to reach, in the select, the
multiselect, the option field and both calendars.
