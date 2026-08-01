---
"@modyra/widgets": major
---

Whether a part must exist is a decision per kind, not a default

A part was mandatory only if its name was one of eight strings — globally, for every widget. Everything
else was optional, which is not a decision that it may be absent: it meant no renderer could be caught
omitting a checkbox's indicator, a toggle's thumb or a select's arrow, because the contract had never
been asked.

Twenty-six parts across twelve kinds are now declared mandatory. The list is measured rather than
assumed: every one is a part all three renderers already emit in the resting state, so nothing is
being demanded that is not already true. Parts some renderers omit stay optional.

Optional parts fall from 79% of the anatomy to 68%.
