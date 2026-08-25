---
"@modyra/plain": patch
---

A press on the edge of a field reaches the control

The plain renderer draws a box between the field and its control, inset by 12 pixels on each side.
That leaves a strip along every edge that looks like the field and is not the control: a press there
put focus **nowhere at all** — measured, the document's body kept it — while the same press in the
Lit and Angular renderers lands on the control, because neither of them draws that element.

Every kind with a field shell was affected: text, number, select and the rest.

The box now forwards a press to its control. Only a press on the box itself — one on a prefix, a
suffix or a button inside it still belongs to that element.
