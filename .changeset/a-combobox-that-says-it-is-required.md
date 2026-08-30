---
"@modyra/widgets": minor
"@modyra/angular": patch
---

A combobox says whether an answer is being asked for

A select's trigger is not a native control and carries none of the field's rules on its own. Two
renderers wrote `aria-required` from what they could reach and one wrote nothing, because the
contract declared nothing — each of the three deciding for itself what had not been said.

The select projection declares it, the standalone controller carries it with a `setRequired` beside
`setInvalid`, and the field controller binds it from the handle. A consumer driving the standalone
controller gains a method it must supply.

Angular's multiselect trigger, which had the same gap for the same reason, now says it too.
