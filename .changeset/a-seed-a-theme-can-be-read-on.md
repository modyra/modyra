---
"@modyra/styles": minor
---

The default primary is a colour its own text clears AA on

`.mdy-button` is a filled accent control — `background: var(--mdy-primary)` under
`color: var(--mdy-on-primary)` — and in the default theme that pair shipped at **4.09:1**, against the
4.5:1 WCAG AA asks of normal text. An auditor running axe over a page of every widget kind reported it
ten times.

Nothing was wrong with the derivation. A light `on-` colour is chosen while light clears
`MDY_ON_COLOR_FLOOR`, and on `#7067FF` it does. The floor decides *which* colour; AA is what the pair
must then reach, and they are different numbers. The colour simply could not carry it: the derived
light `on-` colour gives 4.09, `#f8fafc` gives 3.96, and pure white — the ceiling for any light text
on that background — stops at 4.14. Only black reaches AA there, and black on a saturated indigo is
the defect ADR 0015 exists to refuse.

So the seed moved rather than the rule. `--mdy-ref-color-indigo` is now **`#6458EF`**: the same OKLCH
hue and chroma at a lightness of 0.561 instead of 0.607. The derived `on-` colour reaches **4.96:1**
and the pivot still selects light, so the rule governs the choice exactly as before.
`MDY_ON_COLOR_FLOOR` is unchanged, the stylesheet's pivot is unchanged, and a host supplying its own
primary is unaffected.

**Every filled accent surface is 4.5% darker.** The brand assets carry the same value, so the mark and
the product stay one colour. Against a dark ground the mark moves from 4.62:1 to 3.81:1 — still above
the 3:1 AA asks of a graphical object — and improves against light grounds, 3.96 to 4.80 on cloud.

`modyra-salience.theme.css` keeps `#7067ff` deliberately: it pins its own `on-` colour to black, which
reaches 5.07:1. A theme that answers this question itself is not answering it wrongly.

See ADR 0108.
