---
"@modyra/styles": patch
---

A corner of sRGB is judged to be inside sRGB

`isInSrgb` is asked after a round trip through Oklch, so its tolerance exists to absorb that
transform's error. **The tolerance was smaller than the error it exists to tolerate:**

```
#ff0000  overshoot 3.047e-8   in
#ffffff  overshoot 6.953e-8   in
#00ff00  overshoot 1.001e-7   OUT      ← against a tolerance of 1e-7
#ffff00  overshoot 1.303e-7   OUT
```

Two of the eight corners of sRGB were outside sRGB, and a seed passes through a palette as its
`primary` — so `derivePalette("#ffff00")` emitted a colour this package's own predicate rejects.
White clearing the old threshold by a factor of one and a half was luck rather than a margin:
nothing about `#ffffff` at `6.95e-8` is safer in principle than `#00ff00` at `1.00e-7`.

`MDY_SRGB_EPSILON` is `1e-6`, **derived in both directions** rather than picked:

- **large enough** — the measured worst-case overshoot for a colour that *is* in gamut is `1.303e-7`
  over a 4096-colour grid plus the eight corners, leaving roughly seven times that as headroom;
- **small enough** — a colour one part in a million of chroma past the true boundary overshoots by
  `7e-7` to `2e-6`, so this admits at most about `1.5e-6` of chroma beyond the edge. Chroma runs to
  `0.45`: three orders of magnitude below anything a consumer could act on.

The premise is now **checked rather than trusted**: a test measures the worst in-gamut overshoot over
the same grid and fails if it ever exceeds the tolerance, so a change to the transform's coefficients
says the constant needs revisiting instead of putting a corner of sRGB back outside it. A colour
genuinely past the boundary is still refused.

Found by `battle-tests/adversarial/security/palette-contrast.battle.test.mjs`.
