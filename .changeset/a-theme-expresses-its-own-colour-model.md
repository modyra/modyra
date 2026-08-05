---
"@modyra/styles": minor
---

A theme states its design system's colour model, and derives every role from it.

Setting a brand colour is what this product is for, and two themes did not survive it. Measured over
four themes and two schemes, every element that owns text against the surface behind it:

| | before | after |
| --- | --- | --- |
| Material, white on a gold brand primary | **1.85:1** | derived, clears AA |
| Material dark, field text on a gold container | 2.98–3.29:1 | clears AA |
| every theme, labels and supporting text | 3.87–4.24:1 | ≥ 4.5:1 |

**Material is tonal now.** A role is a tone on a tonal palette at an assigned chroma — M3's own model
— rather than a `color-mix` toward white, which is the same ramp for one seed and a different ramp
for every other. On a gold seed the six surface steps had collapsed into a lightness span of 0.018
where M3 specifies 0.10: the surface hierarchy disappeared, and contrast was the symptom. Every tone
and chroma is a variable (`--mdy-md-tone-*`, `--mdy-md-chroma-*`).

The seed is never rewritten. `--mdy-sys-color-primary` stays exactly what a host sets; `--mdy-primary`
is that seed at tone 40, which is why M3's white-on-primary holds again. **Material's palette changes
for every seed but its own** — for a light brand colour the primary becomes a dark tone of that hue,
which is surprising and is what Material Design 3 does.

**iOS names its pairs.** `--mdy-ios-on-blue` is the label colour Apple pairs with system blue, read by
the five sites that sit on the accent instead of `#ffffff` written at each. A host supplying its own
accent supplies both halves.

White on system blue is 4.02:1 and **stays** — it is in the HIG, and a theme that darkened it to reach
4.5:1 would stop being iOS. It is a named allowance in `e2e/palette.spec.ts`, asserted in both
directions so an allowance that stops applying also fails.

**Muted text holds AA.** `--mdy-sys-color-on-surface-variant` paints labels, placeholders, supporting
text and weekday headers — reading text — and cleared the floor only for dark and cool seeds. Swept
over ten seeds and carried to the lightest value that clears 4.5:1 for all of them.

Also fixed: `.mdy-button` and the number stepper took a background from one role and text from
another; a `<button>` in a themed subtree now inherits colour, since user agents set `buttontext` and
a host slotting a plain button into a field got black on the theme's surface, measured at 1.10:1.

Migration: a host that pinned `--mdy-on-primary` keeps working. One relying on Material's or iOS's
literal white sees the derived colour. Material's surface and accent roles move for any seed other
than its own.
