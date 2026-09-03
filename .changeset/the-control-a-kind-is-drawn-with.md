---
"@modyra/widgets": minor
"@modyra/plain": patch
---

Declare the native control six more kinds are drawn with, and stop inventing one for the rest

`controlType` said what a kind's control is for three kinds. Six more have a single native control and
did not declare it, so each adapter carried the knowledge privately — and `plain/text-field.ts` said
what that costs in its own comment: *a private map is how a password ends up rendered in clear text by
one adapter and concealed by another.*

Declared now for `number`, `slider`, `checkbox`, `toggle`, `file` and `colors`. **Measured, not
chosen**: all three renderers already draw the same control for all six — `number`, `range`,
`checkbox`, `checkbox`, `file`, `color` — so this is a finding made law rather than a new opinion, and
nothing on any page moves. Plain's private map is gone with it.

**And the default nobody declared is gone too.** The projection wrote `type: options.inputType ?? "text"`,
which is a drawing decision the contract was taking implicitly — so it applied where it must not: the
plain renderer deliberately passes no type for a textarea, the fallback fired anyway, and the page
carried `<textarea type="text">`, an attribute that element does not have. A kind whose control type
the contract does not declare now leaves the attribute off. A default nobody declared cannot have an
exception, which is the whole reason to declare it.

Kinds with no single native control keep declaring none — a select drawn as a trigger and a listbox, a
daterange as two calendars. That absence is argued in the field's own documentation, and this change
does not disturb it.
