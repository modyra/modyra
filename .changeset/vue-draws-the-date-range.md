---
"@modyra/vue": minor
---

`@modyra/vue` draws the date range: two boxes with a separator between them, and the calendar both
of them fill.

Everything below the panel is the date field's — the same grid, the same six weeks, the same reading
position moved by the same keys — and it is drawn by the same code rather than a second copy that
would agree until only one of them was changed. `test:cross-adapter-similarity` caught the half that
was still duplicated, the key forwarding, and it is shared now too.

What is this kind's own is that a choice takes two presses. The contract carries which end is being
picked and what the range would become, so the renderer reports where the pointer is and draws what
comes back: a preview computed in the component would be a second answer to a question the contract
already answers, and the two would differ at the edges — the day before the start, a range picked
backwards — which is exactly where a person notices.

Both ends carry their own name and the separator does not: what the dash means is already said by
the two boxes being named, and announcing "en dash" between them tells a person nothing they need.
