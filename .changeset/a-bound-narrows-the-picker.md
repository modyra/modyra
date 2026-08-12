---
"@modyra/core": patch
---

A bound narrows the year picker instead of greying it out

`calendarYearRange` widened past whatever it was given: `Math.min(min, …, 1920)`
and `Math.max(max, …, 2120)` meant the floor was always at most 1920 and the
ceiling always at least 2120. A field accepting 2020 to 2030 offered **207
years**, 196 of them rendered and disabled.

A bound is a bound now. Where there is none the span stays wide enough for a
birth date and a far maturity, and the year on screen is always present either
way — a view can sit outside the bounds when a value arrives from a draft or a
server, and a picker that cannot show where it is has no way back.

All three renderers read this one function, so all three narrow.
