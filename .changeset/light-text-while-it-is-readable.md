---
"@modyra/styles": patch
"@modyra/core": minor
---

Text on a filled surface is light while light is readable.

An `on-` colour was whichever of black and white had the higher WCAG 2 contrast ratio. That ratio's
luminance formula weights blue at a fourteenth of green, so it rates dark text on a saturated colour
far above what a reader experiences — and it put black text on a saturated blue in every theme.

Measured, and consistent rather than marginal:

| background | ratio, white | ratio, black | ratio picks | perceptual metric picks |
| --- | --- | --- | --- | --- |
| `#3B82F6` | 3.68:1 | 5.71:1 | black | white |
| `#7067FF` | 4.14:1 | 5.07:1 | black | white |

Across 112 pairs of a derived palette the two disagree on 37, always in that direction.

**The rule is now: light while light clears a floor, the higher ratio below that.** The floor is
`MDY_ON_COLOR_FLOOR`, newly exported from `@modyra/core/color-utils` — the one addition to the public
surface. Following the perceptual metric without a bound was rejected on measurement: it puts 36 of
those 112 pairs under AA, the worst at 2.96:1.

`onColorFor` had the same defect. It is exact rather than estimated, and it returned black for
`#3B82F6` too, because it was maximising the same ratio — so precomputing a palette would not have
avoided this.

**The floor is below AA for normal text, deliberately**, and above the 3:1 that AA asks of large text
and UI components. [ADR 0015](https://github.com/modyra/modyra/blob/main/docs/architecture/0015-light-text-while-it-is-readable.md)
states the cost and what to do about it under a strict audit.

**Migration:** a host that sets its own `on-` colours sees no change. One deriving them sees light
text where it saw dark on saturated mid tones — including `--mdy-sys-color-on-primary`, which the
datepicker's selected day and every filled control read.
