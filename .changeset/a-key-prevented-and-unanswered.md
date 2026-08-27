---
"@modyra/widgets": patch
---

Backspace stops being swallowed at a multiselect trigger

The overlay policy answered `Backspace` with "clear the search" when the search was **already empty** —
an action that changes nothing, handed to a caller that prevents the default because it was given an
action. All three renderers therefore swallowed the key at the trigger and did nothing with it,
including with the panel closed, where there is no search box to clear.

The key is declared on the chip, where it takes a chosen value off. Claimed at the control it was
taken from the person and given to nobody: **a key that is prevented and unanswered is worse than one
nothing claims**, because the platform's own meaning goes with it.

And `audit-type-surface` stops reading documentation as surface. A doc comment sits inside an inline
object type in the emitted declaration, so rewording one changed the compared string and was reported
major on a type whose members had not moved. A comment cannot break a consumer; a member can, and
members still are.
