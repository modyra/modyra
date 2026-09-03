---
"@modyra/vue": minor
---

`number` joins, and the bench caught the config reading the wrong value

The number field's required parts are the text field's — root, wrapper, control — so it needed no
component of its own, only the type its catalogue entry declares. Its two stepper buttons are
declared optional, because the platform draws its own: a renderer that omits them leaves the kind
with the keyboard and the native affordance rather than with nothing.

Adding it found a defect in the conformance config rather than in a renderer. The config reported the
control's DOM string as the field's value, and for four kinds that was right by accident — a text
field is empty at `""`. A number field is empty at `null`, and the kit said so the moment one was
asked: `number: value is "", expected null`. The config now reports the field's value and starts each
form at the empty the kind declares, so a kind whose empty is neither of those cannot pass by
resembling the ones before it.
