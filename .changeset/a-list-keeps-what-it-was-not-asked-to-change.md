---
"@modyra/core": patch
---

A structural change to a list resets the rows it moves, and only those

An array rebuilt every row on every structural call — remove them all, register them again. That is
invisible for values and expensive for everything else attached to a row:

- a control bound to a row nothing moved **lost its claim**, and with it what a binder had said about
  the cell, so a disabled column came back enabled and was **submitted** after a push at the other
  end of the list;
- `push` cleared the touched and dirty marks of every existing row, so the errors a form only shows
  on a visited field vanished when the user added a line;
- `remove(9)` on a list of three — which removes nothing — did the same.

Rows that survive a change are now written in place, and only the rows the change actually moved are
marked clean: none for a push, from the insertion point for an insert, from the removal point for a
remove, across the span for a move, all of them for a whole-value write. An out-of-range removal is
no longer a change at all.

Also fixed alongside: `submitValue()` and `getChanges()` threw `Flat patch does not match schema
shape` for any list whose row carried a disabled cell or a partial change, because the shape guard
demanded complete rows from a value that is partial by definition.
