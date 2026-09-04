---
"@modyra/vue": patch
---

`@modyra/vue` can be driven into the states it declares, and the six defects that came out of driving
it are closed.

Its conformance config answered `false` to almost every state, so the section that inspects a widget
*in* a state — the one that would have caught five components rendering once and never again — had
never run against this package. It drove **6 of 150 pairs**. It drives **148** now, reading the
reference renderer's own fixture rather than inventing a driver: the value through the handle, the
refusals through the form, the opening through the element the catalogue names.

What driving it found, all of it invisible until now:

- **`select` drew no error list in either shape.** Its projection publishes no shell parts at all —
  no label, no description, no errors — so every renderer spells those ids itself. This one now does
  for the third as it already did for the first two. *The projection gap is a finding, not a design:
  four renderers each invent the same three ids.*
- **The date, range and time pickers kept `aria-disabled` on a toggle that was still pressable**, so
  a panel could be opened over a field the model had taken out of play.
- **The colour field's hex box announced none of its states and enforced none of them** — a control
  saying it refuses while accepting what a person types, whose value the model will not hold.

The two states still not drivable are named in the report rather than counted: `loading` on `select`
and `multiselect` needs a remount this config does not offer.

One of the six was a finding about the bench rather than the renderer: driven "invalid" with no rules
declared, an empty field is *correctly* valid. The fixture now declares a rule by default, as the
reference renderer's has always done.
