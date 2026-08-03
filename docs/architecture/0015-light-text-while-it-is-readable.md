# ADR 0015: Light text while it is readable

Status: Accepted

## Context

A selected date rendered as black text on a saturated blue. The derivation was not broken — it was
maximising the WCAG 2 contrast ratio, faithfully, and the ratio preferred black.

WCAG 2's relative luminance weights the blue channel at 0.0722 against green's 0.7152. A saturated
blue is therefore rated far lighter than it looks, and dark text on it scores higher than light text
that a reader finds obviously easier. Measured on three blues:

| background | ratio, white | ratio, black | ratio prefers | APCA, white | APCA, black | APCA prefers |
| --- | --- | --- | --- | --- | --- | --- |
| `#3B82F6` | 3.68:1 | 5.71:1 | **black** | 69.4 | 40.2 | white |
| `#7067FF` | 4.14:1 | 5.07:1 | **black** | 73.5 | 36.1 | white |
| `#2563EB` | 5.17:1 | 4.06:1 | white | 80.2 | 29.2 | white |

APCA is the perceptual metric WCAG 3 is built on, and it exists because of this class of failure.
Across 112 pairs of a derived palette the two metrics disagree on **37**, and never in the other
direction: where they differ, the ratio is the one choosing dark.

Neither metric can be followed alone. The ratio is what an accessibility audit measures and what
most compliance regimes name. The perceptual metric is what a reader experiences, and following it
without a bound puts 36 of those 112 pairs under AA, the worst at 2.96:1.

This was not confined to the stylesheet. `onColorFor` in `@modyra/core/color-utils` is exact rather
than estimated — it measures both candidates instead of approximating — and it returned black for
`#3B82F6` too, because it was maximising the same ratio. Precomputing the palette would not have
fixed the defect; the metric was the defect.

## Decision

**An `on-` colour is light while light clears a contrast floor, and the higher ratio below that.**

The floor is `MDY_ON_COLOR_FLOOR`, 3.5:1, exported from `@modyra/core/color-utils`.

The rule reduces to a single number, which is what makes it expressible in a stylesheet that cannot
compute a ratio at all: 3.5:1 against white **is** a relative luminance of 0.25, and the perceptual
crossover sits above that, so the floor is always the binding constraint. Checked against 1296
sampled colours, a plain `Y ≤ 0.25` threshold reproduces the full rule with no disagreements.

Two implementations follow it. `color-utils` measures ratios directly. `modyra-base.css` compares an
estimated luminance against the threshold, in two tiers depending on what maths a colour channel
admits.

## Consequences

**The floor is below AA, deliberately.** 3.5:1 does not meet WCAG 2's 4.5:1 for normal text. It sits
above the 3:1 that AA requires of large text and non-text UI components. A product audited strictly
against AA for this text will find pairs that do not meet it, and that is the price of not putting
dark text where a reader wants light. It is a stated cost, not an oversight.

**Two implementations of one policy can drift**, and one of them is a stylesheet that cannot be unit
tested in Node. They are bound by a test that parses the stylesheet and by browser tests that read
painted pixels, and the threshold is asserted to *equal the floor expressed as a luminance* rather
than being a second copy of a number.

**The stylesheet estimates and therefore errs.** The corrected form disagrees with the exact rule on
1.4% of a 6000-colour sweep and the uncorrected form on 4.6%. The floor bounds what that costs, and
the browser tests hold each tier to a measured figure rather than to the ideal.

**A gamut-clipped colour can still fall short.** The stylesheet decides on the colour it was asked
for; the browser paints the colour clipped into sRGB, and clipping moves lightness. `color-utils`
avoids this by round-tripping through hex before deciding — CSS has no equivalent. This is the
residual the pivot tier's lower floor absorbs.

**Existing palettes change.** A host deriving `on-` colours sees light text where it saw dark on
saturated mid tones. A host that pinned its own sees nothing change.

## Alternatives rejected

**Keep maximising the contrast ratio.** Zero pairs below AA, and the reported defect stays: dark text
on saturated blue in every theme. Rejected because "compliant" and "readable" came apart here, and
the ratio is only a proxy for the second.

**Follow the perceptual metric with no floor.** Correct on every reported case and on design
convention. Rejected on measurement: 36 of 112 pairs fall below AA, the worst at 2.96:1, which trades
a visible defect for an invisible one.

**A higher floor.** 4.5:1 flips one pair of 112 and fixes nothing. 4.0:1 flips 15 and still leaves
`#3B82F6` dark, which is the case that prompted this. 3.5:1 is the lowest floor that fixes the
reported range while staying above the UI-component threshold.

**Precompute every palette with `color-utils` and stop deriving in CSS.** Exact, and it gives up a
primary the host can set at runtime with no JavaScript on the page — which is the reason the OKLCH
model exists in this shape. Still open as a separate question, recorded as finding **M** in
`docs/contract-gaps.md`; this decision does not foreclose it, and would survive it unchanged since
the metric is the same either way.

## Verification

- `npm run test:core` — `color-utils.test.mjs` asserts the rule as a rule: light wherever light
  clears the floor, the better ratio below it, and a named case on a saturated blue whose ratio
  alone would refuse. It also asserts the stylesheet's threshold **equals** the floor expressed as a
  luminance, so the two cannot drift into disagreement.
- `npx playwright test e2e/palette.spec.ts` on three engines — reads painted pixels, holds each tier
  to its measured floor, and checks the direction of the choice on the tier that can compute it.
- Falsified rather than assumed: reverting the threshold to its previous value fails both suites.
  A rule whose tests pass either way is not being held by them.

## Security and privacy

No trust boundary is touched. Colours are derived from a value the host supplies to itself; nothing
is stored, transmitted, or parsed differently, and an attacker gains nothing if the arithmetic is
wrong.

The impact is accessibility, and it is the reason the decision exists rather than a side effect of
it. The honest statement of the risk is the one in *Consequences*: this rule knowingly ships text
below WCAG 2 AA for normal text, in exchange for text a reader finds easier. A product with a strict
AA obligation should treat that as a finding and set its own `on-` colours.
