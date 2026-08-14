---
"@modyra/widgets": patch
---

A picker opens on the time the field holds, and a step lands where the step says

**The timepicker replaced a value it could not parse.** `parseAnyTime` is strict per format — a
`"12h"` picker reads `"10:37 AM"` and not `"10:37"` — so a value in the other notation parsed to
nothing and the draft became the **current wall-clock time**, which confirm then wrote:

```
field "10:37", 12h picker  →  dial shows now  →  confirm writes now
```

The user opened a field already showing a time, saw a different one, and pressed the button the dial
is for: the ordinary action lost the value while cancelling preserved it. Reachable from a draft
written by a `"24h"` build, from an API, a patch, or a hand-written document — the value contracts
say nothing about notation.

Both notations are read now, and the field's format decides only how the value is written back. That
last part is a representation repair, the same shape as replacing a loosely-matched option value with
the option's own: **the time is preserved, its notation is normalised**. An empty picker still opens
at the current time, which is what every picker does and what a heavy-handed fix would take away.

**The stepper drifted off its own step.** `0` stepped up by `0.1` five times gave
`0.1, 0.2, 0.30000000000000004, 0.4, 0.5`, and a price, a rating or a weight steps by a fraction. That
value is what the field shows and what the form submits: it fails a `multipleOf` rule and is not
equal to the `0.3` a server compares against. `<input type="number" step="0.1">` snaps to its step,
and this widget stands in for that control.

A stepped value is rounded to the step's own decimal places — a whole-number step leaves large
integers exactly as they are.

Found by `battle-tests/adversarial/interaction/`.
