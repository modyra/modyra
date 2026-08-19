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
anything. A row that contributed no field holds nothing at the place it occupies, in the shape its own
declaration has.

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

`{}` is the smallest thing that occupies a position without asserting a value.

## Amendment: nothing has the shape of the row it stands for

A row is not always a set of cells. A positional collection may hold leaves — `array(field(""))` is
a list of words — and `{}` in one of those positions changes the **type** of the element: a list
declared as words arrives with an object in it, and a receiver validating a list of words rejects
the whole payload rather than the one position it cannot read. Before this record it received a
shorter list of words: wrong about position, right about type.

So the placeholder is the empty form of the row's own declaration, read from the schema and not from
the held value — an object-valued *leaf*, a range or a colour, is one value and not a row of cells:

    row of cells      {}            an object with none of its members
    row that is a list  recursion   a list of the same length, each row standing for nothing
    row that is a value undefined   nothing, which is what a value that was not sent is

`undefined` rather than `null`, because `null` is a value a leaf can hold — a field the person
cleared reads `null` — and a receiver could not tell a withheld row from a row holding nothing.
`undefined` is not in a leaf's domain, so it cannot be mistaken for one, and `JSON.stringify` writes
it as `null` in an array, which is the only thing the wire format has. In process the distinction
survives; on the wire it degrades to the ambiguity, and that is stated rather than hidden.

`MdySubmittedValue` is widened to say this: a positional row is `MdySubmittedItemValue<I> |
undefined`, a row of cells is the partial of its own schema. The type said *"arrays keep their
element type: a row is submitted whole or not at all"*, which this record had already made untrue.

**The cost this does not remove.** A schema that validates the element type still rejects the
payload: `z.array(z.number())` refuses `[1, null, 3]` exactly as it refused `[1, {}, 3]`. Keeping
the position and keeping the element type are not both available — the only shape that preserves the
element type is the shorter list, which is what this record rejects. What changes with the amendment
is that the type is only broken where a row is missing, rather than everywhere a list of leaves is
sent.

## Alternatives rejected

**Keep the compaction and document it.** It was documented — in a battle written to record it, not to
defend it. Documentation does not reach the server correlating by index, and the failure is silent at
every layer: no type changes, no diagnostic fires, and the payload is well-formed.

**Omit the whole collection when any row is fully disabled.** Turns a local ambiguity into total data
loss for the list, and gives a consumer nothing to merge.

**Send `null` for a row of cells that contributed nothing.** Puts a value in the payload that no one
entered, and a required-object schema on the receiving side rejects it. `{}` is refused by the same
schema for the same reason, but it is refused as *empty* rather than as *null*, which is what
happened. For a row that *is* a value there is no `{}` to send — see the amendment.

**Make it an option.** Two readings of a positional payload, chosen per form, is the outcome this
record exists to prevent: whoever reads `list[0]` cannot see the option.

## Verification

- `battle-tests/adversarial/submission/a-row-that-left-no-gap.battle.test.mjs` — asserts a positional
  payload keeps the positions the form holds, in both collection kinds, with a control row proving
  the measurement is about the emptied row rather than about disabling in general.
- `battle-tests/adversarial/submission/an-empty-row-in-a-list-of-words.battle.test.mjs` — asserts a
  list of leaves is submitted holding leaves, with the row-of-cells case beside it as the control, so
  a repair of one half cannot break the other.
- `packages/core/test/core.test.mjs` — the submitted-value cases covering the field promise, which
  this decision does not move.

`battle-tests/adversarial/submission/a-row-that-moves-because-another-left.battle.test.mjs` records
the contrast between the two collection kinds under this decision: the positional one holds the
position and sends nothing in it, the keyed one drops the name.

## Security and privacy

No trust boundary moves and no new data is emitted: `{}` carries nothing the form did not already
withhold. The defect this closes is an integrity one — a receiver could attribute one row's values to
another row's identity, and a system that authorizes or audits per row could act on the wrong one.
