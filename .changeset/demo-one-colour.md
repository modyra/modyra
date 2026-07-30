---
"@modyra/styles": patch
---

The demo's colour picker sets one property

It set both `--mdy-sys-color-primary` and `--mdy-primary`, and had to: the themes declared their own
primary at the short tier, so setting only the `sys` one could not reach them. But setting both also
*froze* the bridge — an inline `--mdy-primary` outranks the rule that derives it from `sys` — so the
palette could not follow the picker even in principle.

One declaration point makes one line enough. Measured: setting `--mdy-sys-color-primary` to a green
moves `--mdy-primary`, the derived `--mdy-sys-color-secondary` (to hue 176.5, the primary's 146.5
plus the model's 30) and `--mdy-chip-selected-bg` with it.
