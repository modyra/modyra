# ADR 0095: A flat pair carries the shape of a row

Status: Accepted

## Context

`flattenDynamicForm` takes a document apart into the pair a renderer consumes — a list of flat fields
and a list of the collections those fields passed through — and `buildFlatFormSchema` puts the pair
back together into a schema. The round trip is a published route: a host stores a document in one
shape and builds a form from the other.

A flat field is a path, and a path names a row that exists. A collection declared with no rows
therefore contributes nothing to the field list, and the pair said only that a collection of some
kind lived at some path. A form rebuilt from that pair had no template to make a row from, and it did
not refuse: a keyed collection accepted `upsert("k", …)`, reported `keys() === ["k"]` and returned
`{}` from `getValue()` — the collection saying the row was there and the value saying it was not, in
one form at the same moment. A positional one accepted `push` and stayed empty. A consumer learned
nothing until it read the value back.

The tree route has the shape all along: it builds from `item`. Only the flat route lost it, and the
flat route is the one a document over a wire takes.

## Decision

`MdyDynamicCollection` carries `item`, the row's shape flattened with names relative to the row, as
`MdyDynamicFlatForm` — the same `{ fields, collections }` pair, one level down. Two shapes a row can
have that are not a group of named cells are spelled by position rather than by name: a row that is
itself a leaf is the single field named `""`, and a row that is itself a collection is the single
collection at path `""`.

`buildFlatFormSchema` uses the template only where the fields say nothing — a collection whose rows
exist is still described by its rows, so a stored pair keeps behaving as it did. The templates are
built by node identity through a worklist, not by descending into each item as it is met: one
template per item node however many rows quote it, and no stack spent on a document's nesting.

## Consequences

The pair is bigger. A document whose collections are deeply nested carries one template per item
node, and a consumer that compares two flattenings with a deep equality now compares the templates
too — the workspace's own tests had to compare `path` and `kind` where they meant the kind alone.

`item` is optional, so a pair produced before this decision still builds, with the old behaviour for
empty collections: the field says nothing and the rebuilt row has no shape. This is what makes the
addition shippable as a minor, and it is also the hole — an old stored pair is not repaired by
reading it with a new parser.

The template is a shape, not values. A row's own data still arrives through the flat fields, one leaf
at a time, because every row's values are its own.

## Alternatives rejected

**Make the rebuilt collection refuse.** Refusing is an answer a consumer can act on, and it was the
cheaper repair. It leaves the round trip unable to carry an empty collection at all, which is the
common shape — a document declares the list and the rows arrive from a user.

**Emit a template row under a reserved key.** The shape would ride in the field list with no contract
change, and it would put a row in the value that the document never declared. A phantom row is worse
than a missing shape.

**Derive the shape from the collection's validators or layout.** Neither describes cells that have no
rows, and both are optional slots a document may omit.

## Verification

`battle-tests/adversarial/dynamic-contract/flattened-and-put-back.battle.test.mjs` is the check: it
declares a row in a form rebuilt from the pair, for both kinds, and requires the collection to hold
what it was given or to refuse. `npm run test:type-surface` holds the shape of the addition, and
`npm run test:core` covers the flattening of a document at the depth bound, where a template built by
descent spent the stack.

## Security and privacy

The pair now carries the declared shape of a row for collections that hold no data. A template is a
document's own declaration, already public to whoever holds the document, and no value travels with
it: a field's `initialValue` in a template is the one the document declares, not one a user typed.
The walk is bounded by the document's node count and builds each item once, so a hostile document
cannot make the templates cost more than the document itself.
