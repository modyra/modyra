---
"@modyra/vue": minor
---

`@modyra/vue` draws the colour field — the second panel here that keeps Tab, and it keeps it for a
different reason than the time one.

There is a single action beside the choices, the entry for a colour that is no preset, and the
arrows never leave the swatch grid by design. A Tab that dismissed the panel therefore left that
button operable with a pointer and with nothing else (ADR 0198). Tab is read from the contract
rather than from its name — this kind declares it a `move` while open, which is what makes it a walk
instead of a dismissal — and it wraps, because a panel that holds the key is a room. Escape is still
the way out.

The grid is **one** stop, not one per swatch: the arrows move within the palette, so exactly one
swatch is a Tab stop and reaching the action takes one press rather than as many presses as there
are presets.

Measured against the reference renderer rather than assumed: the button a person presses is the
native picker, which is also what opens the panel; the part named `toggle` is the area around it and
is declared presentation, so it presses nothing. The `control` projection carries the relations and
no classes, so the part's own class is added by the renderer — without it the part is on the page
and no check can find it.
