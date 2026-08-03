---
"@modyra/styles": patch
---

The readable text colour degrades instead of failing.

`--mdy-sys-color-on-*` derives black-or-white from the background with a `clamp()` step, inside a
feature query for relative colour syntax. The step needs more than that: it needs `pow()` and `cos()`
**inside a colour channel**, which is a narrower capability. An engine with one and not the other
parsed the declarations, failed them and dropped them — and what caught them was a fixed
`color-mix(primary, white 95%)`, which is 95% white whatever the background is. Measured at 1.10:1
on a light primary: white text on a light background.

Three tiers now, each guarded by what it actually uses:

| tier | needs | worst pair measured |
| --- | --- | --- |
| chroma-corrected pivot | `pow()`/`cos()` in a colour channel | 4.35:1 |
| lightness pivot | relative colour syntax | 4.09:1 |
| fixed mix | nothing | unchanged |

The middle tier is new and is what stops the fall. It takes the same `clamp()` step over a plain
lightness pivot — the cube root of the luminance crossover, exact for a grey — and every engine with
relative colour computes it identically. It picks the worse of black and white 38 times in 1080
against the corrected form's 16, which costs a fraction of a ratio point rather than legibility.

`e2e/palette.spec.ts` now holds each tier to its own measured floor, chosen by `CSS.supports` rather
than by browser name, so an engine that gains the maths is held to the better floor the day it ships.

**This is a repair, not a solution.** No tier reaches AA's 4.5:1, because a stylesheet cannot measure
what it is approximating: it has the colour in OKLCH and the ratio wants sRGB luminance. The exact
computation exists — `onColorFor` in `@modyra/core/color-utils` measures both candidates and keeps
the better — and the themes do not use it. Recorded as finding **M** in `docs/contract-gaps.md`.
