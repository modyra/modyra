---
"@modyra/styles": patch
---

The chip, the segment and the slider paint through their own tokens

A census of every colour those three controls declare: 30 declarations already went through a
component token, 45 reached past their own tokens into a system colour, and **2 were literals** —
both in a hover state.

**`.mdy-chip__btn:hover` was `rgba(255, 255, 255, 0.2)`.** White, calibrated for the selected chip,
which is dark. Measured on an *unselected* chip in all four themes, the hover moved the rendered
pixel by exactly **0** — white over white. The +/− steppers on a counter chip had no hover feedback
at all, in every theme, since they were written. It is now `--mdy-chip-btn-hover-bg`, mixed from
`currentColor`: on those buttons that is the chip's own label colour, so the tint darkens a light
chip and lightens a dark one by construction — the same contrast that makes the label readable makes
the hover visible. Measured after: 31 on the unselected chip, 23–31 on the selected one.

**`.mdy-segmented__button:hover` in iOS was `rgba(120, 120, 128, 0.1)`** — a near-twin of that
theme's own `--mdy-ios-fill`, except that being a literal it kept its light-mode alpha in dark mode
while every fill around it moved. It reads the token now.

Four colours these controls paint had no token to reach them by, so a theme wanting any of them had
to restate a rule. They have one, each defaulting to exactly what was computed before:

- `--mdy-segmented-btn-bg-hover` / `--mdy-segmented-btn-color-hover` — the unselected button's hover
  had none while the selected button's did, so a theme could restyle half a control.
- `--mdy-slider-value-color` — the readout beside the track.
- `--mdy-slider-thumb-shadow` — the handle's elevation, which every theme was writing **twice**, once
  per vendor pseudo-element.

Material and iOS now set those on `.mdy-slider-container`, the part the contract already gives the
slider, and delete the rules they were restating.

Two things measurement decided:

- **iOS keeps its segmented hover rule**, tokenised rather than deleted. It flattens the button with
  `background: transparent` in `mdy.themes`, and a later layer beats any specificity in an earlier
  one — so the foundation's `:hover` in `mdy.components` cannot reach past it. A theme that
  neutralises a background must restate the states that background had.
- **The handle's shadow is asserted on the control, not on `::-webkit-slider-thumb`.** Chromium's
  `getComputedStyle` reports `none` for that pseudo-element whether the shadow comes from a rule or
  from the token — verified by putting the old literal rule back and reading `none` again.

The new demo test hovers each control in all four themes and measures the composited pixel. It fails
against the previous stylesheets.
