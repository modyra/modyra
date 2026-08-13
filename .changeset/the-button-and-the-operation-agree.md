---
"@modyra/core": patch
---

`canUndo` and `canRedo` answer for the value as it is now

`undo()` records any change the snapshot effect has not seen before it pops, so a row declared,
removed or renamed is undoable in the task that changed it. The two signals a consumer binds an
Undo and a Redo button to were still answering for the last state the scheduler had seen.

The gap was reachable from ordinary code: a click handler that adds a line and a toolbar that
re-reads its own state run in the same task, so `canUndo()` read `false` while `undo()` would have
removed the row. Its mirror lit a Redo button after an edit that had already invalidated the redo
stack, offering an operation that did nothing.

Both are now derived from the current value rather than stored, so the affordance and the operation
answer the same question. The cost is one value comparison per read after a change, on signals a
consumer reads to paint a button.
