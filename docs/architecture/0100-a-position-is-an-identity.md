# ADR 0100: A position is an identity

Status: Accepted

## Context

`submitValue()` promises one thing: *what would be sent right now — every field except the disabled
ones*. That is a promise about **fields**. The engine kept it by building the payload out of the
flat map of enabled fields, and a row of a positional collection whose fields are all disabled
therefore contributed no key at all. The list assembled from what was left was shorter, and every row
after the missing one arrived at a position it does not occupy.

Three rows, the first one's only cell disabled:

    getValue      [{tag: "first"}, {tag: "second"}, {tag: "third"}]
    submitValue   [{tag: "second"}, {tag: "third"}]

A server reading `list[0]` is reading the row the person can see below it. Nothing in the payload
says a row was omitted, and nothing in the type moves — the field promise is kept exactly, and the
meaning of every surviving position is changed.

The keyed collection has no such reading: a key that is absent is absent, and the remaining keys are
where they were. So the same interaction — a renderer saying "this line is locked" the ordinary way,
by disabling its controls — means one thing in a record and another in an array.

## Decision

In a positional collection, a row occupies its index in the submitted value whether or not it sent
anything. A row that contributed no field is submitted as `{}` at the place it holds.

The field promise is unchanged: a disabled field contributes no key, at any depth. What is added is
that the *list* is not rebuilt from the surviving rows — it is rebuilt against the rows the form
holds, so `submitValue().list.length === getValue().list.length` for every array in the form.

Keyed collections are untouched. An absent key stays absent, which is the reading a merge already
has.

## Consequences

A payload can now carry an empty object where a row sent nothing. A consumer that treated every row
in the list as populated will see `{}`, which is a shape it has to handle — but it is a shape that
says "this row sent nothing", where the shorter list said nothing at all and said it invisibly.

Assembling a submitted value is no longer a pure function of the flat enabled map: it reads the held
value to learn how many rows each array has, and the flat key set to learn which of them sent
something. That is a second traversal on submit, proportional to the payload, and it means an array
path's identity (`_arrayPaths`) is now load-bearing at submit time as well as at write time.

`null` in the gap was never available: it would put a value in the payload that nobody entered.
`{}` is the smallest thing that occupies a position without asserting a value.

## Alternatives rejected

**Keep the compaction and document it.** It was documented — in a battle written to record it, not to
defend it. Documentation does not reach the server correlating by index, and the failure is silent at
every layer: no type changes, no diagnostic fires, and the payload is well-formed.

**Omit the whole collection when any row is fully disabled.** Turns a local ambiguity into total data
loss for the list, and gives a consumer nothing to merge.

**Send `null` for a row that contributed nothing.** Puts a value in the payload that no one entered,
and a required-object schema on the receiving side rejects it. `{}` is refused by the same schema for
the same reason, but it is refused as *empty* rather than as *null*, which is what happened.

**Make it an option.** Two readings of a positional payload, chosen per form, is the outcome this
record exists to prevent: whoever reads `list[0]` cannot see the option.

## Verification

- `battle-tests/adversarial/submission/a-row-that-left-no-gap.battle.test.mjs` — asserts a positional
  payload keeps the positions the form holds, in both collection kinds, with a control row proving
  the measurement is about the emptied row rather than about disabling in general.
- `packages/core/test/core.test.mjs` — the submitted-value cases covering the field promise, which
  this decision does not move.

`battle-tests/adversarial/submission/a-row-that-moves-because-another-left.battle.test.mjs` asserts
the superseded behaviour and is red under this decision. It is owned by the battle suite and is
handed back with this record.

## Security and privacy

No trust boundary moves and no new data is emitted: `{}` carries nothing the form did not already
withhold. The defect this closes is an integrity one — a receiver could attribute one row's values to
another row's identity, and a system that authorizes or audits per row could act on the wrong one.
