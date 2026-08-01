---
"@modyra/widgets": minor
---

`MDY_CANONICAL_DISABLED` and `MDY_CANONICAL_OPEN` complete the static half of renderer equivalence.

Four states are now compared across three renderers — at rest, invalid, disabled, open — with one
recorded divergence between them.

`disabled` is rest plus one state and deliberately nothing else: a field that is disabled *and*
required *and* empty is two states at once, and a renderer getting either wrong would be reported the
same way. `open` promotes `popup` from optional to required — a renderer may mount an overlay eagerly
or build it on demand while closed, but showing none while open is not a free choice — and flips the
opener's `aria-controls` from naming nothing to naming what the contract says it controls.

**`focusOwner` can now be left unconstrained**, and is, for the kinds where two renderers make
different defensible choices. A combobox may keep focus on its opener and drive the list with
`aria-activedescendant`, or move focus into a search field; a timepicker may open on its dial or on
its inputs, having a `modeToggle` precisely because both are modes. Freezing one of those would buy
agreement by forbidding a legitimate implementation. It stays asserted where the contract does decide:
a calendar takes focus into its grid, because a grid the keyboard cannot reach is a grid only a mouse
can use.

**The fixtures' portal scan is gone.** Each adapter's fixture looked for a portalled overlay by
scanning the document for something dropdown-shaped, and passing that result — even empty — overrode
the snapshot's own lookup, which finds the overlay through the relation that names it. Closed, this
cost nothing and hid itself; open, it reported the popup absent and the opener's reference dangling
on both listbox kinds. The naive scan was the method rejected when the snapshot was first written,
reintroduced beside it.

Recorded, not fixed: opening a `daterange` in `@modyra/plain` leaves focus where it was, while its
own datepicker moves it into the calendar and so do the other two renderers.
