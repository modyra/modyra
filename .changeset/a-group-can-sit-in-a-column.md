---
"@modyra/studio-contract": minor
"@modyra/studio-ui": minor
---

A group is something a row can hold

A layout slot pointing at a container was expanded to the field names underneath it. In a section
that was invisible; in a column row it was the reason a group could never be put beside a control —
the cell was built for one child and received however many fields the group happened to contain, and
the group stopped existing in the compiled contract altogether.

A container slot now compiles to a **section** carrying the container's own id and label, with those
same leaf names as its children. The row holds one child. Nothing new was added to the Contract to
make this work: `MdyDynamicLayoutChild` has always allowed a nested layout node, and both
`@modyra/plain` and `@modyra/angular` have always rendered one inside a column cell — the compiler
was throwing away the only thing that made the slot a container.

Studio follows: the group box has the same column button a field has, side drop zones so a control
can be dropped beside it, and the neighbour search no longer skips containers when pairing. A group
at the form root can now be put side by side with a control, by button or by drop, and its fields
stay inside it.

A group **inside** another container still has no column button, unchanged and for the reason it
always had: its parent already owns where it renders.

Outside a row this is visible too — a group slot in a section now renders as a titled box rather
than as loose fields, which is what the slot said all along.
