# ADR 0210: A promise points at what keeps it

Status: Accepted

## Context

An opener that leads to a panel announces what it opens and names the element it opens. Those are two
attributes and one sentence: `aria-haspopup` claims a role, `aria-controls` says which element has
it. A reader told *this opens a grid* and sent to an element with no role has been told about a grid
that, as far as the page is concerned, is not there.

Six kinds make such a promise. Measured across all six rather than the two that surfaced first:

```
select       promises listbox  → options   role listbox   keeps it
multiselect  promises dialog   → popup     role dialog    keeps it
datepicker   promises grid     → grid      role grid      keeps it
timepicker   promises dialog   → popup     role dialog    keeps it
daterange    promises grid     → popup     role null      broken
colors       promises listbox  → popup     role null      broken
```

The two that broke it were not missing the thing promised. A date range declares a `grid` that
carries `role="grid"`, and a colour field declares `presets` carrying `role="listbox"`. Both pointed
past those at the panel that contains them — a container with no role of its own — so the promise
named an element that could not keep it. Every renderer reproduced this, which is what made it a
contract defect rather than a divergence.

## Decision

**`aria-controls` points at the part that carries the role `aria-haspopup` promises.**

The reference names a **sub-region, not the panel**. A date picker already points past its own popup
at the calendar inside it, and that is the shape APG gives a date dialog. Four of the six kinds
followed this before it was written down; the rule is not "the panel carries the role" but "whatever
is pointed at does".

So `daterange` points at `grid` and `colors` at `presets`. Neither promise changes, and no part's
declared role changes: only the reference moves, onto the element that was already carrying what was
being promised.

## Consequences

A kind whose panel holds several things must choose which one the promise is about, and that choice
is now visible in the catalogue instead of implied by whatever the panel happened to be. A colour
panel holds a hex box and a native picker besides its presets; naming the presets says the promise is
about the list, and says nothing about the rest — which is honest, and narrower than a reader might
assume from the panel as a whole.

It also means a renderer must be able to give the pointed-at part a stable id. Three of the four
renderers compute the controlled id themselves rather than asking `overlayControlledId`, so this
decision reaches Angular and not the others until they do. That gap is real, measured, and left
open here rather than implied to be closed.

## Alternatives rejected

**Promise `dialog` wherever the panel is composite.** A colour panel and a date range panel both hold
auxiliary controls, so one could argue the promise should describe the panel rather than a region
inside it. It lost on the measurement: it would have moved the four kinds that are correct today in
order to accommodate the two that were not, and the date picker's own panel carries navigation
alongside its calendar while still promising `grid` — so auxiliary controls demonstrably do not tip
the promise. A rule that rewrites the healthy majority to spare the exception is the wrong way round.

**Declare a role on the panels instead.** Giving `daterange.popup` a `grid` role and `colors.popup` a
`listbox` role would satisfy the sentence without moving the pointer, and it would be a lie about the
element: a container holding a hex box, a native picker and a preset list is not a listbox, and
saying so would put every one of those controls inside a list for a screen reader.

## Verification

`packages/widgets/test/a-promise-points-at-what-keeps-it.spec.mjs` derives the roster from
`MDY_POPUP_OPENERS` — every kind that declares a promise, not a list written by hand — and fails
where the part pointed at does not carry the role promised, naming the parts that do carry it so the
reader is told where the promise could land. Aiming `daterange` back at its popup fails it.

The check is on the contract, not on a rendered page: it says the declaration is coherent. Whether a
renderer emits the id it is told to is a separate question, and today three of four do not ask.

## Security and privacy

None. The change moves an ARIA reference between elements of the same widget; no data crosses a
boundary, and nothing about it is reachable to a party who could not already read the page.
