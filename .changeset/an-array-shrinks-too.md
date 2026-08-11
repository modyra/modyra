---
"@modyra/core": patch
---

An array shrinks as well as grows, so undo stops leaving a row behind and a draft stops resurrecting one.

The engine writes flat paths, and a field absent from a whole-value write is set to `null` rather
than removed — it cannot know a path belongs to a row that should cease to exist. `onReplace` exists
for that: a whole-value write hands each collection the paths it carried, so a row it does not
mention is gone. A keyed collection implemented it; an indexed one did not, and reconciled on the
engine's list of field *names*, which a restore never changes.

Two user-visible failures came from it. Undoing a `push` left the row in place with its fields at
`null` and killed the redo — the restored value no longer matched the snapshot that was asked for, so
the history recorded it as a fresh edit — which lost what the user had typed and left a row they had
not created. And a draft saved after deleting a row brought that row back on the next visit, carrying
its seeded value: real data the user could submit without noticing.

`MdyPathGate.isOpen` is now **optional**. A collection that does not govern existence omits it —
nothing below the prefix is refused, a control mounting still creates the field, and the field stays
its owner's to remove — and registers only to hear the shape of a whole-value write. Pruning is
restricted to whole-value writes: a draft that excludes a key, a patch that names one field, or a
cell being typed into says nothing about how many rows there are and prunes nothing.

See ADR 0026, amendment "an indexed collection states its shape without governing existence".
