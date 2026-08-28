---
"@modyra/widgets": minor
---

Seven more parts say when they are there, and one earlier reading was wrong

177 of 185 optional nodes now carry a condition, up from 169.

**`chips` and `chipRow` follow the value.** The changeset before this one said the opposite — that
they are containers built once and kept, and only their contents follow — and the page contradicts
it: with nothing chosen there is no strip at all, not an empty one. That reading came from seeing
them constructed in the renderer's setup; what it missed is that the strip is built and then not
attached until there is something to put in it.

**`arrow`, `box`, `increment`, `decrement` and `fileList` are `kindOffersIt`**: drawn because the
kind has them, not because of anything the field is doing. The condition is not vacuous — it says a
renderer that draws this kind another way is still conformant, which is what `optional` alone left
each of them to decide privately.

Eight stay silent, and each now records **what it is actually present under**, in the words of the
renderer that draws it: the pointer is over a chip, more chips are chosen than the strip can show, an
undo is on offer, a file was refused, the field says it is loading. The rule is known; the word for
it in `MDY_PART_PRESENCES` is not, and eight words each used once would be a list rather than a
vocabulary. Written down so whoever adds the word does not rediscover the rule first.

The check gained the direction that cannot be escaped by weakening a declaration. Reading the
contract and holding the page to it is half a guard: a part re-declared as something else leaves the
set the check looks at and passes. So it now also reads the page first — a part that appears only
once the field holds a value — and asks the contract what it says about that part. Moving `chips` out
of `valueIsPresent` used to pass; it fails now.

That direction needed two corrections of its own before it could assert anything. It could not tell
`option` from `chip`, which share `mdy-chip`, so it now measures the overlap on the page rather than
comparing declared class lists. And it flagged `optionLabel`, which is a *required* part inside an
optional popup — always there while its option is, so asking what state brings it about has no
answer. Required parts are out of its scope.
