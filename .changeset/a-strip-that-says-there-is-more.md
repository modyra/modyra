---
"@modyra/widgets": patch
"@modyra/styles": patch
---

A strip that says there is more

ADR 0127 lets a multiselect's chip row scroll only where something reaches what leaves the viewport.
The wheel and the roving focus are that mechanism; nothing told a person there was anything to reach.
Twelve chips in a control that shows four looked like a control holding four.

Two answers, one for each way of reading a control:

- The strip carries `aria-describedby` pointing at the field's own description, which already says how
  many are chosen. A reader standing on the strip is exactly the person who cannot see that it runs
  on, and the count is the fact that makes the hidden chips worth looking for.
- A scroll shadow at each end, in CSS and self-adjusting: two gradients scroll with the content and
  paint the field's surface over the shadow at whichever end is exhausted, so the cue is drawn only
  while chips really are hidden that way. No measurement, and no class a renderer has to keep in step
  with the scroll position.
