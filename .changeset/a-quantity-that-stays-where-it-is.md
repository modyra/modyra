---
"@modyra/widgets": patch
---

A quantity that stays where it is

Stepping a counter chip reordered the value behind it. `increment` appended the new occurrence to the
end of the array, so `["a","b"]` stepped on `a` became `["a","b","a"]` — while the strip, which draws
each distinct value once at its first position, did not move. The two disagreed and neither looked
wrong on its own: the control showed one order and the form submitted another, silently, on a press
that was supposed to change a number.

One more of a value now goes in beside the ones already held, and one fewer takes the last of the
group so what remains keeps the positions it had. A value not yet held still starts its own group at
the end, which is where a first choice goes.
