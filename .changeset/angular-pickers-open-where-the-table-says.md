---
"@modyra/angular": patch
---

The pickers open from the part the contract names, by pointer and by keyboard.

`MDY_POPUP_OPENERS` says which part a person operates to open each kind's popup. Two of them named
parts this adapter did not answer:

- The datepicker and the timepicker declare `opener: "control"` — the field's own input, the large
  target a person clicks to fill the field in — and only the small button beside it opened anything.
- The daterange declares `opener: "toggle"`, and its toggle carried `tabindex="-1"`, so the one part
  the contract names as its opener could not be reached by a keyboard at all. The picker had no
  keyboard route in.

Both are answered from the contract's table rather than per renderer.
