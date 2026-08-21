---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A multiselect's popup can be used with a keyboard

Opening the list with a keyboard reached the filter box and stopped there: `ArrowDown` moved nothing
and `Enter` took nothing, so a person who could not use a pointer could open the options and not
choose from them.

The popup's own keyboard policy has returned `move` and `select` all along — **the controller had no
cursor to send them to**, so every renderer dropped them, and plain's source said so in a comment. The
controller has one now: `activeKey`, a cursor and not a selection, walking the *filtered* options
because a cursor that walked the declared list would stop on rows the search has hidden. It clears
when the query changes and when the popup opens or closes, since a position carried between showings
is one the person never chose.

The search box names it with `aria-activedescendant`: the cursor is not focus — focus stays in the box
being typed into — so naming it is the only way to say where it is.

**Angular kept its own index and moved it before asking what to take**, so one `ArrowDown` landed on
the second option. That is the third piece of state that component held a second copy of, after the
timepicker's view and its focused field.

Two more from an accessibility review:

- **Every chip states its position** — `aria-posinset` and `aria-setsize`. Independent of the live
  region and of anything drawn, so it survives a stripped stylesheet and a dropped announcement.
- **Every move is announced** — "Roma, moved to position 3 of 12". Reordering with a modifier and the
  arrows has no *grabbed* state to announce, so the movement itself is the only thing there is to
  say; unannounced, a reorder is invisible to somebody who cannot see the strip. The sentence is
  composed before the intent is dispatched, because the dispatch runs the render that reads it.

And the counter chip's steppers follow the **mode**, not the count. A repeated value can arrive from a
document on a field that declared no mode, and it is tempting to offer the steppers there since the
chip does say three — but a toggle-set holds membership, so a repeat is a malformed value rather than
a quantity, and steppers would invite making it four.
