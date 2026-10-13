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

A path that does not resolve cannot be used to highlight the offending member in an editor, and two
distinct members that print the same path cannot be told apart.

## Decision

- A diagnostic `path` is an RFC 6901 JSON Pointer that resolves in the document as it was given to
  the reader. Every key-built segment is escaped as a pointer token: `~` becomes `~0`, then `/`
  becomes `~1`, in that order.
- A finding about a field points where that field was written. In a flat list that is its entry by
  index — the first object carrying the name, since every reader claims a name before any other check
  and a later entry with it is the refused duplicate. In a tree it is the leaf's declaration,
  `…/field`, reached by key through groups and through `item` for a collection.
- Every row of a collection is read from one `item` template, so a finding about that template is
  reported once, at the template, not once per row.
- The three readers produce the same path for the same document.

## Consequences

- A path can be resolved against the document to find the member it names, and two members never
  share a path.
- Paths for child keys containing `/` or `~` change spelling, and the `integer` version gate moves
  from `/fields/<name>/…` to `/fields/<index>/…` or the leaf's tree path. A host matching those paths
  as strings has to follow; the changeset states it.
- A tree field's path is recovered by retracing its dotted name through the schema. That relies on
  keys never containing `.`, which `isSafeDynamicSegment` refuses today; if that ever changes, the
  retrace becomes ambiguous and this decision has to be revisited with it.
- Each reader carries its own escape helper. They are three copies of a two-line rule, held equal by
  each reader's tests rather than by shared code.

## Alternatives rejected

- **Refuse `/` and `~` in names.** Smaller in code, but it turns accepted documents into refused ones
  to fix a reporting defect in documents that are valid today.
- **Keep the gate's path by name and only escape it.** Escaped, `/fields/a~1b` is still a name in an
  array position: well-formed and still pointing at nothing.
- **Report the gate once per row of a collection.** Every row points at the same template word, so
  the duplicates add no information and make one mistake look like many.
- **A second, structured location field beside `path`.** Adds public surface to repair a promise the
  existing field already makes.

## Verification

- `packages/core/test/a-diagnostic-path-is-a-json-pointer.test.mjs`: keys `a/b` and `x~y` report at
  `…/a~1b` and `…/x~0y`; the `integer` gate points at the entry index in a flat list and at the leaf
  in a tree, once per collection template.
- `MdyDynamicFormParserTest` in `sdk/java/modyra-contract` holds the same cases for Java;
  `a_finding_points_where_the_field_is_written` in `sdk/rust/modyra-contract/tests/contract.rs` for
  Rust, run in CI.
- Falsified on 2026-10-13 by mutation: dropping the escape, escaping `/` before `~`, dropping the
  per-template dedupe, taking the last entry with the name instead of the first, and omitting the
  `item` segment each turn the TypeScript tests red; the Java equivalents of the first four turn its
  tests red.

## Security and privacy

A path is reported data: no reader interprets one, and no package in this repository parses a
diagnostic path beyond matching a prefix. Escaping makes a path harder to forge, not easier — a key
can no longer produce segments that impersonate a sibling member in a host's error display. No user
data is involved.
