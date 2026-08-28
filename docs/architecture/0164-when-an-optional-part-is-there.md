# ADR 0164: When an optional part is there

Status: Accepted

## Context

193 structure nodes were `optional: true` and not one said **when** it is on the page.

`optional` is a careful declaration — it says a renderer may leave a part out while its parent is
present, and ADR-level reasoning already sits on it. It stops there. So each renderer decided for
itself when to build an optional part, three renderers decided three times, and conformance could ask
nothing: there is no checking a rule nobody wrote.

Six part names account for more than half the cases — `label`, `requiredMarker`, `supportingText`,
`errors`, `errorItem`, `inlineError` — because they are the shell every field shares, repeated across
seventeen kinds.

The error container is the one that needed an outside answer, and it was asked in ordinary words
without repository vocabulary. The answer corrected the question:

**Reserving the space does not stop the layout moving.** A two-line message moves things anyway, a
long message wraps on a phone, and a validation arriving asynchronously while focus is elsewhere
defeats the reservation entirely. Whoever reserves the space believing they have closed the jump
stops watching it.

**It is still right, for a different reason.** Someone leaving a field is moving toward the field
below — which is exactly what moves when a message appears under the field they just left. Not the
thumb travelling to submit: the thumb travelling to the next field, on validate-on-blur. That is the
frequent case, and it is the zero-to-one-line jump the reservation closes.

**One line, not the longest possible message.** Reserving two lines everywhere is paying every day
for a rare case.

**Under fields that can fail a constraint, not under all of them.** Read from the field, not from its
kind: an optional note with a length limit has a constraint, a checkbox that must be ticked has one, a
free-text note with none does not. Alignment between fields is not the reason for the reservation, so
a field that cannot move anything does not carry it.

**The reservation stays after a correction.** Taking it back when the message clears is the same jump,
upward, under the same thumb.

## Decision

`MdyWidgetStructureNode` gains `presentWhen`, drawn from a closed vocabulary, `MDY_PART_PRESENCES`.

It is `presentWhen` and not `when` because `when` already means the overlay phase on a key binding.
One word carrying two meanings is how a declaration comes to be read two ways.

The conditions are declared in **one table keyed by part name**, `MDY_PART_PRESENCE`. This anatomy is
declared twice — written out once for the shell every field shares, and derived again for each kind —
and a condition copied into both drifts the first time one is edited. Both read the table.

The error container is present under `fieldCanBeInvalid`: the field has constraints, so it can fail
one. Its contents are present under `errorsAreVisible`.

`MdyPartPresence` is derived from the array rather than written beside it. A union restated next to
the list it mirrors is a second declaration, and a check reading the restatement passes while the
list grows past it.

**A missing condition is a gap; a wrong one is worse.** A wrong condition tells a renderer to build
something at a moment when it is not wanted, and nothing notices until it is on the page. So a name is
declared only where the contract itself justifies it, and the rest are recorded in a baseline that may
only shrink. 112 of 193 nodes now carry a condition; 81 remain.

## Consequences

A renderer can be held to *when* it builds an optional part, which nothing could ask before. That is
also the cost: 81 nodes are now visibly undecided, where before all 193 were invisibly so.

The error container appearing at rest under constrained fields makes every such field one line taller
whether or not it is failing. On a long form on a phone that is real added scrolling, and it is the
price of not moving the field someone is reaching for.

Two audits were repaired to see this, and both were reading a field rather than a relation:

- `contract-diff` snapshotted `optional` and `repeated` and not `presentWhen`, so it reported the
  contract unchanged while every optional node in it gained a condition. Its verdict contradicted a
  direct reading of the change, which is the case where the tool is not the authority.
- `audit-type-surface` records a union's members from syntax, so `(typeof ARRAY)[number]` read as
  having no members and the eight it has read as removed. Six other aliases were recorded `(opaque)`
  for the same reason, `MdyWidgetKind` and `MdyWidgetState` among them. Those were still classified
  through the other shapes that move with them — the repair adds precision, and did not uncover a
  class of breakage that was escaping.

## Alternatives rejected

**Write the condition beside each node.** 193 places to disagree, and the shell's anatomy exists in
two declarations already.

**Free text.** Unreadable to a check, and a check is the entire reason to declare the condition.

**Decide all 68 part names now.** A condition asserted without evidence is worse than an absent one,
and 62 of them are popup internals whose presence rules deserve their own reading.

**Reserve the error line under every field.** Rejected on the outside reading: the reservation exists
to stop movement, and a field with no constraints moves nothing. Uniform height between neighbours is
not the property being defended — the height a field had a second ago is.

**Reserve space for the whole message rather than one line.** Paying on every field, every render, for
the longest message that might ever appear.

## Verification

`packages/widgets/test/when-a-part-is-there.spec.mjs`: the silent list may only shrink and may not
carry a name that has since been decided; every declared condition is in the vocabulary, read from
`MDY_PART_PRESENCES` rather than restated; the shell and the per-kind derivation agree on every part
they share.

Falsified by planting three defects, each caught: a declared condition removed; a condition outside
the vocabulary; the two anatomies made to disagree on one part.

`contract:diff` after the repair classifies the 112 additions **minor** — gaining a condition tells a
renderer something it was deciding for itself and breaks nothing it already does — and classifies a
changed or withdrawn condition **major**. Both branches were exercised by planting them.

**Not verified: that any renderer obeys these conditions.** The contract now says when a part is
there; nothing yet checks that a renderer builds it then. That check is the next batch, and until it
exists these are declarations, not enforced behaviour.

## Security and privacy

None. `presentWhen` is metadata about when a part is rendered; it carries no data and grants no
access. The error container being present at rest shows no content until there is an error to show.
