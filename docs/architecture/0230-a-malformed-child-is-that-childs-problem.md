# ADR 0230: A malformed child is that child's problem

Status: Accepted

## Context

A tree document's group names its children, and each child must be a node: `field`, `group`, `array`
or `record`. Two kinds of child are not: a bare value (`"v": "x"`) and an object whose `node` is a
word the reader does not know (`{ "node": "nope" }`).

The reader treated either as a defect in the shape of the whole tree. One such child beside a valid
field turned the document down in both modes: lenient returned no fields at all, while the same
document with an unknown field *kind* in that place kept the valid sibling and refused one field.
Measured on the TypeScript reader:

| a group holding a valid text field and… | lenient fields | accepted / rejected |
| --- | --- | --- |
| a field of unknown kind | 1 | 1 / 1 |
| a bare value | 0 | 0 / 1 |
| an unknown node | 0 | 0 / 2 |
| a bare value, alone | 0 | 0 / 0 |

So two defects of the same size, one declaration the reader cannot use, got answers of different size,
and the counts disagreed with ADR 0071. A bare value was not counted as a declaration at all, so a
document holding only one reported nothing entered and nothing refused.

The Java reader shares this behaviour. The Rust reader does not reach a verdict at all: it
deserialises the tree into typed nodes, so a bare value, an unknown `node`, or a `node` written as a
list is a deserialisation error in either mode, with no diagnostic and no form.

## Decision

**A child of a group that is not a node is refused alone.** It is reported as
`MDY_DYNAMIC_INVALID_NODE` at its own path, counted as one declaration refused, and skipped by the
walk. Its siblings are read as they would be without it. Lenient mode returns them; strict mode
refuses the document, as it refuses any document carrying an error.

**The shape of the walk is still structural.** A schema that is not a node, a group without
`children`, and a collection whose `item` is not a node still turn the document down whole: without
them there is no tree, or no row shape, to read the rest against.

**A rejection is a declaration, not a finding.** `rejectedCount` counts declarations refused. A field
kept with a finding, such as a select that loses a duplicate option, is accepted. A field refused for
one reason is reported once, at its declaration and under its own name.

**What only the walk sees is reported at the cell's declaration.** A row's initial value that the
cell's kind cannot hold drops that row's cell, is reported at `…/item/field` under the row's dotted
name (`"items.0"`), and counts as one refused. The declaration itself is judged once, not once per
row.

Decided by TypeSafe on 2026-10-14, with 99% confidence, against keeping the whole-document refusal,
which is the first alternative below.

## Consequences

A lenient read of a document with a stray value now renders the fields around it. A host that
treated "lenient returned nothing" as the signal for a broken tree must read `ok` or the
diagnostics instead. `ok` was already false in both cases, so a host reading it sees no change.

Two places stay structural for reasons that hold only as long as they are true: the root, because
there is nothing around it, and a collection item, because every row is read through it. A future
reader that can render a collection without its template would reopen the second.

Every reader that reports counts must follow this. A reader that keeps the old whole-document
refusal disagrees with the others on any document holding a stray value.

The Rust reader does not follow it yet, and the shared corpus cannot carry a document with a
malformed child until it does: that corpus treats a reader that fails to produce a result as a
broken test, not as a refusal. Until Rust reads such a child as a diagnostic, the decision is held
by the TypeScript and Java suites alone.

## Alternatives rejected

**Keep refusing the whole document, and record it as intended.** This is the smaller change, and it
has a principle behind it: a tree with a hole in it may not be the tree its author meant. It lost
because the reader already accepts that argument's opposite one level down. An unknown field kind is
an equally unreadable declaration, and lenient mode keeps that field's siblings. Two answers for one
size of defect is the inconsistency ADR 0071 exists to remove.

**Treat a malformed collection item the same way.** A collection with no usable item has no shape
for its rows. Dropping only the item would leave a collection that is declared and holds nothing,
and the counts would have to invent a rule for what that collection is.

## Verification

- `packages/core/test/a-tree-answers-each-declaration-once.test.mjs`: a bare value and an unknown
  node beside a valid field leave that field in lenient and nothing in strict, at 1 accepted and 1
  refused. A bare value alone counts as one refused. A non-node schema and a non-node collection
  item still refuse the document. A refused leaf is reported once, under its own name. A field kept
  with a duplicate-option finding counts as accepted. A row value its cell cannot hold is reported
  once, at `/schema/children/items/item/field`, naming `"items.0"`.
- A mutation that walks non-node children again turns three of those cases red.
- The shared corpus pins strict validity and code sets only (ADR 0186), so it cannot tell this
  decision from the old one. Each SDK that reports counts holds the same cases in its own suite.

## Security and privacy

The walk now skips a child it cannot read instead of stopping. That child is never entered: it is
not walked, flattened or rendered, and no member of it is read beyond `node`. A document cannot use
the change to reach anything it could not reach before. No data handling changes.
