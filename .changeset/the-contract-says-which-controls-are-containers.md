---
"@modyra/widgets": minor
---

The contract declares how each kind's value is read, so no renderer decides it

Two checks disagreed across three renderers because the question was filed as a property of a
*control* — which sounds like something each renderer settles. It is not. An accessibility and
interaction specialist, consulted knowing nothing of this repository, put it in one line:

> Equal height is not a rule. It is a **consequence**. The rules are alignment for everyone, and a box
> for containers.

Every field has one place where its value shows — its slot. Look *inside* a surface to read it and the
field is a container: it carries the box and sits in the column. Is the slot *itself* the value — a
position, an on or an off — and there is nothing to look inside and no box. Everything else is frame,
and frame has no category.

**Decided by how a value is read, never by how it is entered.** Every hesitation about the table
turned out to be somebody looking at entry: a colour swatch is *pressed*, files arrive from another
window, chips are *removed* one at a time, a segmented row has *words* in it. None of it counts. A
quantity stepped with plus and minus is a container, by the rule rather than as an exception to it.

`MDY_WIDGET_CONTRACTS[kind].valueSlot` is `"container"` or `"shape"`, recorded in the contract
snapshot: changing one is **major**, because every renderer draws that kind differently afterwards and
a theme keyed on the box is drawing it for a control that no longer has one.

Nothing renders differently today — the table records what the renderers already do. What changes is
that it is now declared once and checked, rather than agreed on by three implementations that nothing
was asking.
