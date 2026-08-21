---
"@modyra/styles": patch
"@modyra/angular": patch
"@modyra/lit": patch
---

A checked box is drawn checked again

Moving a boolean's drawn part inside its label — so the empty remainder of the row would stop
toggling the field — broke every rule that paints its state. Those rules name a *relationship*:
`.mdy-checkbox__control:checked + .mdy-checkbox__indicator` is the input and the box **beside** it,
and the box is no longer beside it. The state changed, the class stayed, and nothing repainted.

Nine rules across checkbox and toggle now ask the wrapper instead —
`.mdy-checkbox:has(.mdy-checkbox__control:checked) .mdy-checkbox__indicator` — which holds wherever
inside the field the drawn part sits. All three renderers share the stylesheet and all three were
affected.

A toggle given no label also drew no track: the Angular and Lit templates built it inside their
`@if (label())`. The track is anatomy — the catalogue declares it a part of every toggle — so it now
renders either way, still inside the label element, because the native input is hidden and the label
is what forwards a press to it.

`packages/plain/test/state-rules-reach-their-part.test.mjs` is the check that was missing: it reads
the shipped stylesheet, takes every selector that decides a boolean's state, and asserts each one
still selects something in the rendered field. The theme audit compares class names on both sides and
stayed green throughout, because both sides still named the class.
