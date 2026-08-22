---
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A guard that asks about what the widget published

`reportIdCollision` asked whether two elements carried *the widget id* — a name a renderer need not put
on anything. plain puts `when__label` and `when__trigger` on elements and nothing on `when`, so the
count was one or zero and the check returned early: two forms from one document collided in silence in
the renderer whose ids are hand-written into consumers' pages the most.

It takes the ids the widget actually put on the page, read from the page, and reports the ones another
element shares. Two more timing defects fell out of measuring it that way: plain asked before the
effect that writes its ids had run, and lit latched after its first frame — which can be before the
form it collides with exists at all. plain asks a microtask later; lit checks every update and says
each id once.

The shape is worth naming: **a guard that asks about something the thing it guards does not have**
passes, and passing is what makes it invisible.
