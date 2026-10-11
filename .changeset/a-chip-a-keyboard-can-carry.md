---
"@modyra/vue": patch
---

A Vue multiselect chip can be picked up and carried from the keyboard

On a field that offers reordering, `Enter` on a chip picks it up, the arrows along the strip carry
it, `Enter` puts it down and `Escape` puts it back where it was picked up. Each step is announced,
and the held chip carries the `dragging` state class. With nothing held, `Escape` stays with
whatever else answers it; a field that does not reorder holds nothing.

A moved chip is now announced by its own name. When two neighbouring chips swapped, the announcement
could name the chip that was passed rather than the one moved, with the pointer handles and with
the keyboard alike.

No migration.
