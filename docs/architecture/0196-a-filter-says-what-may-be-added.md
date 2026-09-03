# ADR 0196: A filter says what may be added, never what is already held

Status: Accepted

## Context

A multiselect widens its option list for a value the field holds that the list does not carry: an
imported tag, a value from a draft, a row whose catalogue entry was retired. ADR 0029 requires it —
what the widget will not erase, it has to show, and what it shows a person can take off.

A host can also narrow the list, with `filterFn`: a public input on the Angular and Lit renderers,
whose ordinary use is a cross-field rule — the country moves, so the offered cities do.

The two met in a place nobody had looked. The widening ran **twice, on both sides of the host's
filter**: the renderer widened its own copy of the list, the filter then removed the widened option,
and the controller — handed a list that once again lacked a value the field holds — widened a second
time and put it back. Two derivations of one list, disagreeing on exactly one input shape.

Measured in `packages/widgets/test/two-derivations-of-one-search.spec.mjs`, which also isolates the
cause: with no filter, or with one that accepts the held value, the two agree. The disagreement is
not about search. It is about a value the field holds that nothing offers.

## Decision

**A held value is always offered. `filterFn` constrains what may be added, never what is already
held.**

The renderers read the controller's narrowing rather than deriving their own. `filteredOptions` is
what the panel shows, and the widening happens once, inside the controller, after any filter the
host applied.

The domain of `filterFn` is candidacy, not membership. A current selection is state, not a search
result, and state stays visible and operable in every surface that represents it.

## Consequences

- The panel can offer a row the host's filter would refuse. That is the decision, not a defect: it
  is the only row in the list a person may need to remove and cannot add.
- A renderer that narrows the list again for itself reintroduces the divergence. Two did; both now
  read the controller.
- Someone reading `filterFn` as "the options that exist" will be surprised once, by a row they did
  not authorise. The name and this record say otherwise: it is what may be *chosen*.

## Alternatives rejected

- **Hide the held value when the filter refuses it.** It removes a way to correct exactly the value
  that needs correcting, and it removes it first from the list — the surface a person reading with a
  screen reader arrives at. The chip stays either way, so this is a way out fewer for the people with
  fewest.
- **Apply the widening only in the renderer, so the filter always wins.** It makes the controller's
  own list wrong for anyone who reads it, including a host that never had a filter.
- **Pass `filterFn` into the controller.** It moves the host's rule into the contract for one input
  the contract has no other use for, and the composition still has to decide an order — the same
  decision, spelled less visibly.

## Verification

`packages/angular/src/lib/renderers/multiselect/unrecognized-value.spec.ts` mounts a multiselect
holding a value the options do not carry, gives the host a filter that refuses that value, opens the
panel and requires the value to be offered. A control case with no filter runs first, so a panel that
offered nothing at all could not pass by silence, and a second assertion keeps the filter's own work
visible: a value nobody holds and the filter refuses stays out.

Restoring the old derivation in the renderer fails that test and only that test.

`packages/widgets/test/two-derivations-of-one-search.spec.mjs` holds the two derivations side by side
and records where they part, so the next renderer to derive its own answer is told which input shape
will separate it.

## Security and privacy

None. Both routes read the same values from the same field handle; the decision changes which of
them a panel lists, not what is stored, transmitted, or authorised. A held value shown in the list
was already shown as a chip in the same control to the same viewer.
