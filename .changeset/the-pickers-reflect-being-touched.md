---
"@modyra/plain": patch
---

The date and time pickers reflect that they have been touched.

Neither renderer called the field shell's `syncState`, so the root carried no
`mdy-renderer--touched` and the wrapper no error modifier — the treatments three themes key off. A
user could leave a required picker empty, blur it, and see the field styled as though nothing had
happened, while every other kind in this renderer showed its error state.

The same defect was fixed for the select and the option groups when the invalid state was first
compared across renderers; these two were missed because nothing asserted the state afterwards.
Now something does.
