---
"@modyra/core": patch
---

`remove`, `insert` and `move` on a positional collection leave the list alone when the index is not a
position. An index is computed — from a route parameter, a `data-` attribute, a lookup — and the
mistakes that produce no number at all (`NaN` from a failed parse, `undefined` from a lookup that
missed, `null`) passed the bounds check and `splice` then read them as 0: the one shape of mistake
that yields no number deleted the first row and its values, where `-1`, `99` and `Infinity` already
changed nothing. `insert` and `move` put the row at the front for the same reason.
