---
"@modyra/styles": patch
---

Liquid Glass is built as the material's own layers.

The iOS kit composes it out of four named layers — **Blur**, **Tint**, **Specular Light**, **Shadow** —
and the tint carries a *Plus D* and a *Plus L* component. Those names are blend modes: the tint and
the highlight **add** light to what is behind them rather than painting over it, which is the whole
difference between glass and frosted plastic. A highlight painted as flat white is the same white on
a dark wallpaper and on a light one; one that adds is bright over dark and blows out over light,
which is what glass does.

It was one seven-part `box-shadow` — three hairlines, three inset "lens" bands and a cast — doing all
four jobs at once, which is why the highlight could not follow the panel's corner and never varied
with what it covered.

Now: the blur is the backdrop, the tint is the surface, and the specular light is a real layer that
follows the panel's radius and blends with `plus-lighter` where the engine supports it. Where it does
not, the highlight is painted rather than accumulated and the material still reads correctly — the
blend is an enhancement, never a requirement.
