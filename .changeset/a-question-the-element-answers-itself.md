---
"@modyra/widgets": patch
---

A question the element answers itself

The select projection wrote `aria-disabled` on its trigger in both shapes. On the platform's own
chooser that is a second answer to a question the element already answers: a `<select>` carries
`disabled` as a property, assistive technology reads it, and two sources for one fact is how they
come to disagree.

It is written only for the custom combobox now, which is a button standing in for a chooser and has
nothing else to say it is out of play. The native attribute stays in both — it is what actually
refuses the press, rather than what describes the refusal.
