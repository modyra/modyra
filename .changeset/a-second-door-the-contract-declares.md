---
"@modyra/vue": patch
---

A multiselect opens when the box is pressed, as the contract says it may

`MDY_POPUP_OPENERS` names one opener that carries the ARIA and, for some kinds, an `alsoOpensFrom`:
a part a pointer may press to the same effect. A multiselect declares its box as that second door.
Three renderers opened from it and this one drew the element and wired nothing to it, so pressing at
the caret — the mark that says *this opens* — did nothing at all. The caret takes no pointer events
in any renderer, so the press lands on the box; that arrangement is the working one, not the defect.

Not geometry: the trigger measured 852px, so there was nothing to miss.

The handler is attached only where the press lands on the box **itself**. A chip inside it takes or
moves that value, and a repair that wired the container without asking where the press landed would
open the panel every time somebody removed something — pinned in its own row, and it fails when the
guard is defeated.

The part is read from the catalogue rather than named here, so a kind that stops declaring a second
door stops getting a handler for it, and one that starts declaring it gets one without this file
changing.

**Why it survived.** The second door deliberately carries no ARIA of its own (ADR 0177): a second
element claiming `aria-expanded` would announce two comboboxes for one list. That decision is right,
and its consequence is that every check shaped like a keyboard press or an attribute is blind to this
door by construction. The only question that reaches it is a pointer press, and nothing was asking
one. The bench added here asks it of every kind that declares the door, so the next renderer to
forget is told rather than found.
