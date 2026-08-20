---
"@modyra/core": patch
---

A pattern from a document is refused for a variable body, not only an unbounded one

`dynamicPatternRefusal` looked for repetition with no ceiling and left a counted one alone. A ceiling
on the outer repetition does not bound the work — it writes the exponent as a number instead of
leaving it as the length of the input. Measured in a killable child process, milliseconds by input
length:

                      24     26     28     30      32
    ^(a+){15}b$       85    284    960   3063   >8000
    ^(a{1,10})+b$     85    339   1353   5385   >8000
    (.*a){20}$       408   1714   6592  >8000

Thirty-six characters is minutes, and the match is synchronous, so it is the whole thread.

The check now reads two things: a group's body is *variable* when it holds a quantifier whose minimum
and maximum differ, and a group is *repeated* when what follows it may apply twice or more, counted
or not. A variable body repeated is refused. `(\d{2}){3}` and `(?:ab){3}` are not — a fixed-length
body gives the engine one way to divide the input.

A pattern refused now that was accepted before is a rule the author must rewrite; a variable body is
necessary for the blowup but not sufficient, so a shape like `(ab?){3}` is refused without being
exponential. See ADR 0050.
