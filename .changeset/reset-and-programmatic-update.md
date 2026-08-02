---
"@modyra/widgets": minor
---

`MDY_CANONICAL_FILLED_OBSERVATION` and the reset comparison complete Milestone C's ten.

**Programmatic update** — a value the form put there rather than one the user typed. It is the same
widget as at rest with something in it, and across the whole catalogue the only anatomical
difference either renderer showed is the select's: a filled select shows its value, so the
placeholder that stands in for one becomes optional. No state is reflected — putting a value in a
field is not the user touching it, and a renderer that marked it touched would show validation for
an interaction that never happened.

**Reset** — a widget given a value and returned to the one it started with must look exactly as it
did before it was ever touched. This is the one comparison that cannot be made from a single
observation, because it is about two of them being the same: a renderer leaving a class, an
attribute or a stale display value behind passes every other check, since the state it is left in is
*legal*, just not the one it started in. Making the select's placeholder never come back once
hidden — the classic stale-display bug — fails it and nothing else.

`MdyCanonicalExpectation.value` can now be absent, meaning the contract cannot name it. Used for
exactly one case: a file field's filled value is a `File`, and two files with the same bytes are
still different values, so each fixture makes its own.

**All three renderers pass all six observations with empty ledgers** — at rest, invalid, disabled,
open, filled, reset — plus the open-then-Escape sequence.
