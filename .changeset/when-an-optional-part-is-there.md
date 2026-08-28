---
"@modyra/widgets": minor
---

Every optional part can now say when it is on the page

193 structure nodes were `optional: true` and not one said **when**. `optional` says a renderer *may*
leave a part out and stops there, so each renderer decided for itself when to build it, three
renderers decided three times, and conformance could ask nothing — there is no checking a rule nobody
wrote.

`MdyWidgetStructureNode` gains `presentWhen`, drawn from `MDY_PART_PRESENCES`: a closed vocabulary of
eight conditions a renderer can already answer — the document supplied the content, the field is
required, the field can fail a constraint, errors are visible, the overlay is open, a value is
present, the kind offers it, the view is showing.

Named `presentWhen` rather than `when` because `when` already means the overlay phase on a key
binding, and one word with two meanings is how a declaration comes to be read two ways.

The conditions live in one table, `MDY_PART_PRESENCE`, keyed by part name. This anatomy is declared
twice — written out for the shell every field shares, derived again for each kind — and a condition
copied into both drifts the first time one is edited. Both read the table.

**The error container is present under `fieldCanBeInvalid`** — the field has constraints, so it can
fail one — and its contents under `errorsAreVisible`. Reserved at rest, and still reserved after a
correction: taking the space back when a message clears is the same jump as giving it, upward. Read
from the field, not from its kind: an optional note with a length limit has a constraint.

112 of the 193 nodes carry a condition. The other 81 are recorded in a baseline that may only shrink:
a *wrong* condition is worse than a missing one, because it tells a renderer to build something at a
moment when it is not wanted and nothing notices until it is on the page.

Two audits were repaired to see this, both reading a field rather than a relation. `contract:diff`
snapshotted `optional` and `repeated` and not `presentWhen`, so it called the contract unchanged while
every optional node in it gained a condition. `audit-type-surface` read a union's members from syntax,
so a union derived as `(typeof ARRAY)[number]` looked empty — which also left `MdyWidgetKind`,
`MdyWidgetState` and four more recorded as opaque.

The contract now says when a part is there. **Nothing yet checks that a renderer builds it then** —
that is the next batch, and until then these are declarations rather than enforced behaviour.

See ADR 0164.
