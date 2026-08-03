---
"@modyra/styles": minor
---

The segmented control's checkmark settles instead of overshooting, and the motion vocabulary drops
to three curves.

`--mdy-sys-motion-easing-spring` is **removed**. Its curve —
`cubic-bezier(0.175, 0.885, 0.32, 1.275)` — carried the check past full size and back on every
selection. A 250ms confirmation reads better arriving and settling than bouncing, and the token had
exactly two consumers, both the same `mdy-segmented-check-pop` animation.

Both now use `--mdy-sys-motion-easing-decelerate`, which already existed for precisely this —
"entering the screen, quick to arrive, slow to settle". No new curve was minted: the vocabulary is
smaller, not merely different.

**If you override `--mdy-sys-motion-easing-spring`**, that override no longer applies. Nothing else
read it, so there is no other effect. Override `--mdy-sys-motion-easing-decelerate` to change how the
check arrives.
