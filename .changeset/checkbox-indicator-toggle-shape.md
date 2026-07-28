---
"@modyra/widgets": minor
"@modyra/angular": minor
"@modyra/lit": minor
"@modyra/plain": minor
"@modyra/styles": minor
---

Checkbox gains a contract `indicator` part; the toggle keeps its shape

The checkbox's drawn box is now a real element every renderer emits (`mdy-checkbox__indicator`),
the counterpart of the toggle's `track`/`thumb`. It used to be a pseudo-element on the *label*, so
the tick was positioned against the text and drifted off centre whenever the label's height
changed; it is now centred by the box that contains it.

The toggle's thumb keeps one geometry in both states and only travels — a knob that also grew
between off and on read as two different controls. Travel uses `inset-inline-start` plus a signed
translation, so it runs the correct way in RTL, and it is suppressed under reduced motion.
`--mdy-toggle-thumb-size-checked` is deprecated: it now resolves to `--mdy-toggle-thumb-size`.

Overlays take their surface, outline, radius and shadow from the active theme's semantic tokens
instead of a fixed panel, so a popup is never a light card floating over a dark theme.
