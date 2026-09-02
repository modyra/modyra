---
"@modyra/widgets": minor
---

The conformance kit measures what it claims to measure

The published kit's browser half asked three questions it could not answer. It requested focus on a
candidate opener and pressed keys without checking focus had landed, so a press into `body` and a
widget ignoring a press produced the same report. It asked `input[type=hidden]` for an accessible
name, which a hidden input cannot have because it is not exposed. And its opener lists named two
elements that do not exist in the renderers it ships against.

Focus is now asserted after it is requested: a candidate that does not take focus is not the opener,
and the search continues instead of pressing keys at nothing. Hidden inputs leave the operable
population. The opener lists name real elements.

This changes what a consuming renderer is asked. A renderer that passed because its opener was never
found, or that reported a nameless element it was right to hide, will be measured for the first time —
the keyboard section reaches bindings it had been silently skipping, and its "unreachable" count is
now about the renderer rather than about the kit.

Minor rather than patch, and the reason is the one a consumer cares about: the type surface is
unchanged, so a surface diff calls this a patch and is silent on the only dimension that moves. An
external renderer that updates can go from green to red without having touched anything, and that
deserves the line that announces it beforehand.
