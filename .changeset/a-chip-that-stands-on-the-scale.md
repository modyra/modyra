---
"@modyra/styles": patch
---

A value chip stands on the control scale.

Its height was `calc(var(--mdy-chip-height) - 0.5rem)` — the filter chip's 32px less half a rem,
arriving at 24. That is below the floor at which a control can hold a conformant 24px target, and it
was reached by an arithmetic nobody could argue with because nothing said what it was for.

It is `--mdy-control-1` now: 28px, the smallest height that can hold that target with its border. The
strip is 4px taller for it, and the remove button no longer needs the 24px floor it was carrying — it
grew into the chip's border to reach a size the chip could not give it. The floor belongs to the
control scale, not to every control that has to reach it.
