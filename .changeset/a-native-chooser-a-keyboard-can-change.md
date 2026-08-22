---
"@modyra/lit": patch
---

The native chooser answers a keyboard, and stops showing a value it does not hold

Two defects in the shape a select takes when a document does not ask for search.

It drew no entry for "nothing chosen", so index 0 was a real option: the control read `A` while the
form held `null` — a field that looks answered and is not — and the first keyboard step landed on the
option already showing. There is one now, disabled and gone as soon as something is chosen, and the
chosen option is marked rather than the element's index set: a property binding is applied before the
list it indexes into is redrawn.

And the arrows are answered here as well as by the platform. This shape is chosen for the keyboard
model the control already has, and where the platform draws its list outside the document — a picker
the page cannot see — that model produces no event and the value never moves. Angular's native shape
has always driven itself from the contract's policy for the same reason. Deliberately without
`preventDefault`: where the platform does answer it answers first, lands on the same option, and
setting one value twice changes nothing.
