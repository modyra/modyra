---
"@modyra/core": minor
---

`required` and `isEmpty` agree about what empty means

A form asks *has this been answered?* in two spellings, and they disagreed: on a consent checkbox
nobody had ticked, the form refused the submit with *This field is required* while a rule reading
`isNotEmpty` on the same box revealed the section it guarded — failing in the direction that opens.

Emptiness now follows the kind's value contract in both halves. `false` is empty (a checkbox's
contract says absence is not one of its values, so "not ticked" is how that field says *nothing
yet*), an object whose every member is empty is empty (a `daterange` before either end is picked),
and `0` stays an answer — the slider's thumb is always somewhere, which is the agreement the rest was
made to match. ADR 0094.

**Migration.** A rule written as `isNotEmpty` over a boolean used to fire whatever the box held; it
now fires when the box is ticked.
