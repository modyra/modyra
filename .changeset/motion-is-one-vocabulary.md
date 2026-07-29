---
"@modyra/styles": minor
---

Motion is one vocabulary, and reduced motion is honoured everywhere

Six durations and seven easings were spread across the foundation and the four themes — including
`cubic-bezier(0.4, 0, 0.2, 1)` written two ways, the same curve spelled differently in two files. A
control that opens in 0.15s under one theme and 0.2s under another is not the same control, and
nothing could tell you the two had drifted.

`modyra-base.css` names them in the tier every other value comes from: three durations (`fast`,
`base`, `slow`) and four curves (`standard`, `decelerate`, `spring`, and Material's `emphasized`,
which is genuinely a different curve rather than a fourth spelling of one). The foundation and the
themes read those tokens, each with the tier's own value as its fallback, so a stylesheet loaded
without `modyra-base.css` still moves.

**The half that matters more:** the foundation honoured `prefers-reduced-motion` for two parts out of
fifty-three — the checkbox's indicator and the toggle's thumb — and every popup, chip, focus ring and
calendar cell animated regardless. Ionic honoured it nowhere. One rule now covers the whole `mdy-`
vocabulary, so a control cannot be added that quietly ignores a preference someone has stated.

`audit-styles-architecture.mjs` gains the matching rule, over the themes as well as the foundation: a
literal duration or curve is a defect, and a stylesheet that animates without ever reading
`prefers-reduced-motion` is a defect.
