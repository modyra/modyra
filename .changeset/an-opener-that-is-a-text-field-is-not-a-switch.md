---
"@modyra/widgets": minor
"@modyra/plain": patch
---

An opener that is a text field is not a switch.

`MDY_POPUP_OPENERS` names the element that carries the overlay relation, and for the combobox kinds
that is correctly the typeable control — the pattern puts `aria-expanded` nowhere else. The same
declaration was then read as "the element that toggles the overlay", and those are not the same job.
So the contract stated that a pointer press on a date picker's own text input closes its calendar:
the user reaches for the caret and the field is taken away.

One renderer implemented it literally and one did not. `@modyra/plain` bound the toggle to the
control as well as to the button; Angular bound only the button. The same click did different things
depending on who drew the widget, and the contract endorsed the worse of the two.

`MdyPopupOpener` gains `typeable`, declared for `datepicker` and `timepicker`. Two rules follow from
it:

- the opener still **opens** on every kind, and only closes where it is not typed into — the toggle
  button beside the field is the switch;
- **`Space` opens** the kinds whose opener is a button, and is left alone on the others, because in a
  text field the space bar is a space character and a widget that opened its calendar instead could
  not accept "12 March". The keyboard policy has opened on Space for as long as it has existed while
  the declared bindings claimed the key for nothing — the same disagreement `Tab` had, and it needed
  the opener to be able to say what it is before it could be settled.

`@modyra/plain` no longer closes a date or time picker when the user clicks into its input.
