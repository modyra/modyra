---
"@modyra/widgets": minor
"@modyra/vue": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

A date field shows the date it holds, and says when it cannot read what it was given

`entryText` is not a control's text. It holds only what somebody typed that could **not** be read as
a date, and every path that produces a value clears it. Bound to a box on its own, that box is blank
for every readable value — so vue's date picker and date range held a date, would have submitted it,
and showed nothing. It submits and it is invisible, which is the worst shape a defect takes here.

`dateEntryText(outstanding, held)` answers what the box shows, in the order the two rank: keystrokes
the field could not read outrank the value, because those are still the person's to correct. Three
renderers had written that expression out for themselves and a fourth wrote only its first half. All
of them now ask. Formatting stays the caller's — a renderer knows the locale it resolved and this
package does not — so what is shared is the rule, not the words.

**And the field now says it cannot read what it holds.** Vue never reported an unreadable entry to
the form, so a date picker holding "not a date" showed no message and reported `aria-invalid="false"`
— silent about a value it would not submit. It is reported as one of the field's errors like any
other, which is what makes it obey the rule every other error obeys: switched off, the announcement
and the message both go.

Reported **before** the projection is read, not after. The projection answers whether the control
announces itself wrong and can only count an error the form already holds; read first, the message
appeared under a control still saying `aria-invalid="false"` — one field disagreeing with itself, and
green on any check that looks at only one of the two.

The bench mounts **without validators**, and that is not a detail: with the config's defaults the
field carries `required`, is already invalid and already showing a message, and every assertion here
passes with the entry error never reported at all. Measured — the first version of this bench stayed
green with the report removed under a clean build.
