---
"@modyra/widgets": patch
---

Say "asked with nothing" instead of answering with nothing

`answerDoor` returned an empty class list for a door nobody had asked a question of — the same answer
it gives a door that genuinely puts no class on an element. A page showing the first as the second
tells its reader the opposite of what it exists to say, and the sample tables that supply those
questions are written by hand, so the door added tomorrow is exactly the one that arrives without an
entry.

`undefined` now means *not asked*, and comes back with that reason. A caller that wants a door's own
defaults asks with the empty shape instead — `{}` for an options door, `[]` for a positional one.

The distinction belongs here rather than in each caller. It was found and repaired in one page first;
put in the contract, the second page does not have to rediscover it.

**And the cost this pays back.** Replacing a throw with a graceful answer moved a defect out of the
tier that watches: the throw emptied a page and CI failed on it, while a wrong row fails nothing. A
reason a caller can read is what makes the quiet answer safe, and the page that shows these now fails
its own check when a door has no example.
