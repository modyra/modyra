# ADR 0232: A collection writes at most a hundred rows

Status: Proposed

## Context

The published JSON Schema, v2 to v5, caps the rows a collection's own `initialValue` may write:
`maxItems: 100` on an array's, `maxProperties: 100` on a record's. The Java and Rust readers refuse a
document past it with `MDY_DYNAMIC_SCHEMA_LIMIT`; the TS reader did not, so it parsed documents the
public schema rejects and an editor flags while they are typed. No decision recorded the rule, so the
readers also disagreed on where they reported it: Java at the collection's `initialValue`, Rust at
the collection itself.

ADR 0231 bounds what rows multiply. It also counts written rows, so 10,001 written rows in one
collection were refused in TS by that bound, at `/schema`, and elsewhere by this rule, at the
collection: the same code at two paths.

## Decision

**A collection's own `initialValue` writes at most 100 rows.** Every reader refuses a document whose
array `initialValue` holds more than 100 items, or whose record `initialValue` holds more than 100
keys, with `MDY_DYNAMIC_SCHEMA_LIMIT` at `<collection path>/initialValue`.

- It is a finding about the tree's shape: the schema is refused whole and no fields are returned,
  in both modes, as for an unsafe child name. Rows are therefore not counted against ADR 0231's bound
  for that document.
- Exactly 100 rows are accepted; 101 are refused.
- The rule is on what a collection writes, not on the rows it receives from an enclosing row, which
  ADR 0231 bounds.

## Consequences

- TS now refuses documents it used to parse: a collection writing more than 100 rows is `ok: false`.
  The same documents already failed the published JSON Schema and the other two readers.
- Rust moves the finding's path from the collection to its `initialValue`, which is where Java and TS
  report it and where the JSON Schema's own error points.
- A consumer with more than 100 starting rows supplies them as form data rather than as the
  document's declared initial value. The cap is on the document, not on what a form may hold at
  runtime.
- With every collection under 100 rows, reaching ADR 0231's bound takes nesting: the shared pair at
  that bound is two levels of collections and stays the check for it.
- `MDY_DYNAMIC_SCHEMA_LIMIT` now names three things in TS and Rust, told apart by path: this cap (a
  collection's `initialValue`), ADR 0231's bound (`/schema`), and in Java alone the depth and node
  caps ADR 0043 removed elsewhere.

## Alternatives rejected

- **Drop the cap from Java, Rust and the JSON Schema**, leaving ADR 0231 as the only bound. It would
  widen the published schema, a change for every editor and validator that reads it, to match the
  one reader that did not enforce it. ADR 0231's bound alone would also allow 10,000 written rows in
  one collection, which is no form a person fills in.
- **Report at the collection, as Rust did.** The JSON Schema's error and the existing
  `MDY_DYNAMIC_INVALID_ARRAY` / `MDY_DYNAMIC_INVALID_RECORD` findings about `initialValue` already
  point at the member, so two readers would have had to move instead of one.
- **A distinct code.** Consumers matching `MDY_DYNAMIC_SCHEMA_LIMIT` for size refusals keep doing so;
  the path separates the rules.

## Verification

- `spec/fixtures/dynamic-form/v5/rows-written-at-the-cap.json` (a record of 100 rows, valid) and
  `rows-written-past-the-cap.json` (an array of 101, `MDY_DYNAMIC_SCHEMA_LIMIT`) run in all three
  readers' corpus tests.
- `packages/core/test/dynamic-expansion-limit.test.mjs`: 100 accepted and 101 refused for both kinds,
  in both modes, at `/schema/children/rows/initialValue`, with no fields. Raising the cap to 101
  turns it red.
- `sdk/rust/modyra-contract/tests/expansion_limit.rs` `a_collection_writes_at_most_a_hundred_rows`
  and Java's `MdyDynamicExpansionLimitTest.aCollectionWritesAtMostAHundredRows` assert the same pair
  and the path. The corpus pins code sets only, so the path is held by these reader tests.

## Security and privacy

Reduces what an untrusted document can make a reader allocate: the rows one collection writes are
bounded in every reader rather than only through ADR 0231's visit count. No data handling changes.
