---
"@modyra/styles": patch
---

Material's filled fields and its filled button take their colour from Material's own ramp.

Two roles were read against each other. `.mdy-button` painted `--mdy-input-focus-color` — the
field's focus indicator, which is the brand colour — while its label stayed `--mdy-on-primary`,
derived for `--mdy-primary`: on a light brand that is white on light amber, **1.70:1**. And the
field container came from `--mdy-sys-color-surface-container-highest`, the palette's brand-tinted
surface, while the text on it came from Material's `--mdy-on-surface-variant`: in dark that pairs
at **3.80:1**.

Both now read one ramp: the button paints `--mdy-primary`, and
`--mdy-comp-field-container-color` resolves to Material's `--mdy-surface-container-highest`. Filled
fields in this theme are neutral-tinted rather than brand-tinted, which is what M3 specifies, and
both pairings clear AA.
