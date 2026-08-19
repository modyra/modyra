# ADR 0102: A change set is a payload too

Status: Accepted

## Context

`getChanges()` is documented as *"ready for an API PATCH request"*. A positional collection that
changed is carried whole, because a compacted list of only the changed rows says nothing about where
they were and a server applying it by index writes the wrong row. That part is right.

Where *whole* was read from was not. The rows were filled in from `getValue()`, which holds every
cell the form has, disabled or not — so a cell something had decided must not travel left the process
through the door that carries the row for its neighbours' sake:

    getChanges    { list: [ { tag: "SECRET", note: "n1" }, … ] }
    submitValue   { list: [ {               note: "n1" }, … ] }

A cell is disabled by a permission rule, by a mode the form is in, by a field the person cannot edit.
Both doors answer the same question — what should go to the server — and they answered it
differently about the same form. The keyed and flat halves were already correct, which is what made
the positional one look like a detail rather than a leak.

## Decision

A change set carries what a submit would send. `getChanges()` fills a carried positional list from
the form's *submittable* fields, not from its value, and passes the result through the same
position-keeping walk `submitValue()` uses (ADR 0100). The two doors agree, cell for cell, about
every collection kind.

The list is still carried whole: the rows that did not change are what makes the position of the
ones that did readable.

## Consequences

A change set can now contain a partial row, or `{}` where every cell of a row is out of play. That
is what a submit already sent, so a consumer holding both no longer has to reconcile them — but it
is a shape a consumer of `getChanges()` alone did not see before.

`MdyFormPatch` describes what `patch()` *accepts*, where a positional row is whole: a whole-array
write states which rows there are, and cells a row does not name are written to their declared
initial. Feeding a change set back into `patch()` therefore restores the omitted cells to their
initial rather than leaving them alone. The return type is unchanged and now describes the output
loosely — stated on `getChanges()` rather than fixed by widening `MdyFormPatch`, because widening it
would invite the merge reading that the whole-array write does not have.

## Alternatives rejected

**Carry the row from `getValue()` and let the consumer filter.** The consumer cannot: a change set
does not say which cells were disabled, and the value it carries is indistinguishable from one the
person typed.

**Stop carrying the list whole.** Restores the ambiguity ADR-level reasoning removed — a partial
positional list is not a partial PATCH, it is one a server cannot apply.

**Give `getChanges()` its own return type.** Honest about the output and breaks
`patch(other.getChanges())` at compile time for every consumer, to describe a shape that only appears
when a cell is disabled.

## Verification

- `battle-tests/adversarial/submission/a-change-set-that-carries-what-was-disabled.battle.test.mjs` —
  asserts the flat and keyed halves stay correct, that the list is still carried whole, and that the
  two doors agree. A repair that dropped the row or the list fails there rather than passing.

## Security and privacy

This is the security half of the finding. A disabled cell is the mechanism a host uses to keep a
value from travelling — a permission rule, a read-only mode, a field the person may not edit — and
one of the two published doors handed it out anyway. Any consumer building a request from
`getChanges()` transmitted it. No credential or key is involved by construction, but the values are
whatever the host chose to withhold, which is the definition of the class.
