---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": patch
---

A 24-hour picker can be set to every hour its own face shows

Reported from use: *there is no way to set a time before 13:00, as if pinned to PM.* It was symmetric
— a picker seeded at `09:00` could not reach the afternoon either — because the working copy is
canonically 12-hour, `period` is the only route to the other half of the day, and a 24-hour picker
correctly has no period control. `set-hour` refused everything outside 1–12, and refused it by
returning nothing, which is why it survived the life of the feature.

Every other surface already spoke 0–23: the face draws `00` and 13–23, `timeFieldBounds` answers
`{min: 0, max: 23}`, `acceptTimeField` accepts `"13"`, the End key asks for 23. Only the seam that
writes took 1–12, so the typed segment was as stuck as the dial.

- `set-hour` takes the hour in the picker's own format — 1–12 for `12h`, **0–23 for `24h`** — and the
  controller derives the half of the day. Midnight is `0`, noon is `12`.
- `set-from-angle` gains `ring?: "outer" | "inner"`, optional, because the same direction is 3 on the
  outer ring and 15 on the inner one. `dialHour(angle, ring)` in `@modyra/core/datetime` is the
  arithmetic; `timepickerDialRing(face, x, y, format)` in `@modyra/widgets` is the hit test.
- An hour or minute the clock does not have is refused with an `announce` rather than in silence.
- `viewMode` defaults to `"input"` and is a controller option; opening returns to what the host
  configured instead of a hard-coded view. The dial is one toggle away.

`set-hour 3` on a 24-hour picker now means three in the morning rather than "the third hour of
whichever half the draft was in". A 12-hour picker is unchanged. Anatomy does not move, so
`MDY_WIDGET_CONTRACT_VERSION` does not either. See ADR 0115.
