---
"@modyra/lit": patch
"@modyra/angular": patch
---

A cursor with an element to point at

Typing a letter at an open multiselect moved the cursor in lit and Angular and neither could say
where it went: `aria-activedescendant` named an id no element carried. The projection gives every
option an id and neither renderer put it on the element that draws the option, so the control
announced a cursor pointing at nothing — type-ahead worked and was invisible.

Both now carry the projected id, and mark the option the cursor is on.

**lit also kept its own answer to whether the popup was open** and never told the controller. The two
disagreed about a state only one of them owns, so everything derived from `open` — where the cursor
is, whether it may be announced — was computed against a list the controller believed closed. Opening
and closing now go through the controller and the element mirrors it.
