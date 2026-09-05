---
"@modyra/styles": patch
---

The required marker keeps its contrast on the dark scheme

Material's dark scheme raises every text role off the darker surfaces — `on-surface` to tone 90,
`on-surface-variant` to 80 — and left the error role at the tone chosen to read on a *light* surface.
On the dark scheme that is a mid red on a tone-6 ground: the required marker measured 1.29:1, below
AA, and every error message with it.

The error role now rises with the roles beside it, to M3's own dark tones — error 80, on-error 20 —
so this is the system's answer for the scheme rather than a colour picked to clear a threshold. The
light scheme is untouched.
