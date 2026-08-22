---
"@modyra/lit": patch
---

The clock face honours a granularity before anything is chosen

`stepsNow()` asked whether a draft existed and, finding none, threw the whole granularity away. A
timepicker mounted empty — which is the state a person arrives in — drew every hour on the face and
began honouring a four-hour step only once something had been chosen, after the moment it was for.

The contract function already answers for an hour it cannot place, which is why plain calls it
unguarded. Measured on `granularity: { hourStep: 4 }`: the face drew 24 numbers and now draws 6, with
the seven dimmed stretches its sibling asserts.
