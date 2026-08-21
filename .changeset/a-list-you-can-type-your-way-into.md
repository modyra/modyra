---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A list you can type your way into

Finding the twentieth option in a multiselect's popup meant twenty presses. The APG asks for
type-ahead of any listbox a person can open, and every piece of it was already published —
`createTypeahead`, `isTypeaheadCharacter`, `typeaheadMatch` — and used by nobody here.

A `typeahead` intent moves the cursor to the first option whose label matches what has been typed.
The buffer and the idle window that decides when two keystrokes are one word belong to the
**controller**: a renderer holding them decides that for itself, which is how three adapters come to
answer differently.

Only where there is no filter box. A searchable popup already answers typing by narrowing the list,
and the two would compete for the same keystrokes.

**The cursor is now visible or named wherever focus happens to be.** Plain focuses the option itself,
because its popup puts focus inside; Lit and Angular keep focus on the control and name the option
through `aria-activedescendant`, which is how a control points at something it does not contain focus
for. Without either, the cursor moved and nothing said so.

Fixes a defect found while measuring it: **plain placed focus on every effect pass rather than on the
opening**, so the arrows appeared to do nothing at all — the cursor moved and focus was dragged back
to the first option behind it.
