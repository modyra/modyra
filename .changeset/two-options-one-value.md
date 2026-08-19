---
"@modyra/core": patch
---

A document offering one value twice is told so

Two fields sharing a name are refused, because a name builds an id and two ids that collide stop
being addressable. An option's value builds an id the same way — `s__option__pro` — and nothing
checked it, so `[{pro, "Pro monthly"}, {pro, "Pro yearly"}]` parsed clean, kept both, rendered one,
and left a submitted `"pro"` naming two different things.

The later duplicate is dropped with `MDY_DYNAMIC_DUPLICATE_OPTION`, the way the later of two fields
with one name is. Values are compared by what they hold, so two objects declaring the same members
are one option however they were written, and the document the caller passed is never edited.
