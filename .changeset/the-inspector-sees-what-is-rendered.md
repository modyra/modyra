---
"@modyra/widgets": minor
---

The inspector sees what a widget renders, not only what a caller names

`inspectWidgetDom` built its view of the DOM from the caller's part map alone. A part missing from
that map was looked up nowhere: a mandatory one surfaced as `PART_MISSING`, but an **optional part
that was actually rendered was skipped entirely** — its element type, classes, containment and order
all unchecked. A caller could silence any check by omission, without meaning to.

Unmapped parts are now resolved from the DOM by the classes the contract gives them, over the same
scope every other check uses, so the map is an override rather than the definition of what exists.
Measured on one adapter, five rendered parts were invisible this way.

Two defects surfaced immediately, both in the inspector:

- **Containment only ever tested the first parent.** A part whose parent repeats — a calendar cell in
  one of six rows, a check inside one of many chips — was compared against parent number one and
  reported as mis-parented if it lived anywhere else. Any resolved parent now satisfies it.
- A part the contract marks `repeated` must be mapped with **every** element it rendered; mapping one
  of many made each of its children look mis-parented.
