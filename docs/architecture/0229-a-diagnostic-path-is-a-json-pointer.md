# ADR 0229: A diagnostic path is a JSON Pointer into the document as written

Status: Accepted

## Context

Every finding a dynamic form reader returns carries a `path` naming where in the document it applies.
The paths look like JSON Pointers (`/schema/children/email/field`) and the TypeScript, Java and Rust
readers build them the same way, but two sites did not keep that promise:

- **Child keys were written raw.** A tree names its children by key, and `/` and `~` are legal in a
  key. Child `a/b` was reported at `/schema/children/a/b`, which reads as child `a`, then a member
  `b` that does not exist.
- **The version gate for `integer` pointed at a name, not a place.** A field using `integer` in a
  document older than the version it arrived with was reported at
  `/fields/<name>/validators/integer`. `fields` is an array, so a name there addresses nothing, and
  a field from a `schema` tree was reported under `/fields`, which the document does not have.
  Rust named the flat case the same way and gave a tree leaf a path without its `/field` segment.
- **The same gate missed a template nobody had filled.** TypeScript and Java checked the fields a
  tree flattens to, and a collection with no rows flattens to none, so an `integer` in its `item`
  template passed in a v4 document. Rust walks the declarations and refused it.

A path that does not resolve cannot be used to highlight the offending member in an editor, and two
distinct members that print the same path cannot be told apart.

## Decision

- A diagnostic `path` is an RFC 6901 JSON Pointer that resolves in the document as it was given to
  the reader. Every key-built segment is escaped as a pointer token: `~` becomes `~0`, then `/`
  becomes `~1`, in that order. One exception is kept: a bare array is read as the `fields` list of
  a version 1 document, and every reader addresses its entries as `/fields/<index>`, so a path into
  a bare array resolves against `{ "fields": <the array> }`.
- A finding about a field points where that field was written. In a flat list that is its entry by
  index — the first object carrying the name, since every reader claims a name before any other check
  and a later entry with it is the refused duplicate. An accepted field always has that entry; if
  none were found the finding would fall back to `/fields`, the list itself. In a tree it is the leaf's declaration,
  `…/field`, reached by key through groups and through `item` for a collection.
- A tree is checked by its declarations, not by the rows it flattens to. A collection's `item` is
  the one template every row is read from, so a finding about it is reported once, at the template,
  whether the collection starts with three rows or none.
- The three readers produce the same path, and the same verdict, for the same document.

## Consequences

- A path can be resolved against the document to find the member it names, and two members never
  share a path.
- Paths for child keys containing `/` or `~` change spelling, and the `integer` version gate moves
  from `/fields/<name>/…` to `/fields/<index>/…` or the leaf's tree path. A host matching those paths
  as strings has to follow; the changeset states it.
- A v4 or older document with `integer` in the template of an empty collection is now refused by
  TypeScript and Java, as Rust already refused it. That is a verdict change, not only a spelling
  change.
- The gate walks the raw tree, so it reports a leaf the reader drops for another reason too. Such a
  document is already refused; it gains a finding, not a verdict.
- Each reader carries its own escape helper. They are three copies of a two-line rule, held equal by
  each reader's tests rather than by shared code.

## Alternatives rejected

- **Refuse `/` and `~` in names.** Smaller in code, but it turns accepted documents into refused ones
  to fix a reporting defect in documents that are valid today.
- **Keep the gate's path by name and only escape it.** Escaped, `/fields/a~1b` is still a name in an
  array position: well-formed and still pointing at nothing.
- **Report the gate once per row of a collection.** Every row points at the same template word, so
  the duplicates add no information and make one mistake look like many.
- **Recover a tree field's path by retracing its flattened name.** It gives the right path for every
  field that has a row, and nothing for a template with none — the gap above.
- **A second, structured location field beside `path`.** Adds public surface to repair a promise the
  existing field already makes.

## Verification

- `packages/core/test/a-diagnostic-path-is-a-json-pointer.test.mjs`: keys `a/b` and `x~y` report at
  `…/a~1b` and `…/x~0y`; the `integer` gate points at the entry index in a flat list and at the leaf
  in a tree, once per collection template, including a template of an array or record with no rows.
- `MdyDynamicFormParserTest` in `sdk/java/modyra-contract` holds the same cases for Java;
  `a_finding_points_where_the_field_is_written` in `sdk/rust/modyra-contract/tests/contract.rs` for
  Rust, run in CI.
- Falsified on 2026-10-13 by mutation: dropping the escape, escaping `/` before `~`, dropping the
  per-template dedupe, taking the last entry with the name instead of the first, and omitting the
  `item` segment each turn the TypeScript tests red; the Java equivalents of the first four turn its
  tests red. For the declaration walk: misspelling the `item` segment, reporting only
  `integer: true`, and (in Java) not descending a record's template each turn the tests red.

## Security and privacy

A path is reported data. Nothing in this repository parses one beyond matching a fixed top-level
prefix — `/layout/`, `/rules/`, `/validations/`, `/schema` — which escaping a key segment never
changes. Escaping makes a path harder to forge, not easier — a key
can no longer produce segments that impersonate a sibling member in a host's error display. No user
data is involved.
