# ADR 0231: A document costs what it writes, not what its rows expand to

Status: Proposed

## Context

A collection nested in a row takes its own declared `initialValue` rows in every enclosing row that
writes none. The flatten therefore visits the product of the row counts down each branch, and not
the size of the document. Measured on 2026-10-14 with a group > array(100 rows) > group > array …
shape, `d` levels deep:

| Reader | d | Document | Result |
| --- | --- | --- | --- |
| TS `parseDynamicForm`, lenient | 3 | 1,240 B | 1,000,000 fields, 1.9 s |
| TS, the same shape ending in an empty group | 3 | 1,218 B | 0 fields, 0.4 s |
| Java `parse`, lenient, `-Xmx1g` | 4 | 1,616 B | `OutOfMemoryError` in the flatten |
| Rust | any | — | does not expand rows, so it is not exposed; it accepted documents the others cannot carry |

ADR 0043 removed depth and node caps on the grounds that an explicit stack makes nesting cost what it
writes. Row lending breaks that premise: a document of a few kilobytes names more nodes than a
request can hold, and a reader accepting untrusted documents spends memory and time the document
did not pay for.

## Decision

- A flatten counts **every node it visits** — a group, a collection, a leaf, each node of a row
  template, a leaf it refuses on the walk — and refuses the document once the visits exceed the
  nodes the schema declares (through `children` and `item`, rows not read) **by more than 10,000**.
- Past the bound the whole schema is refused in both modes: `MDY_DYNAMIC_SCHEMA_LIMIT`, severity
  `error`, at `/schema`, `ok: false`, no fields, and no other finding from the walk. A truncated
  tree is whatever part the walk happened to reach first, which is not a form the document declared.
- The flatten called directly (`flattenDynamicForm`, `flattenDynamicSchema`) throws
  `MdyDynamicSchemaLimitError`, carrying `code`, `path` and `limit`.
- Lending is kept. The bound alone closes the cost; stopping it would change the initial values of
  valid documents.
- In Rust, whose result carries the typed document rather than flattened fields, past the bound the
  schema is dropped from the form in both modes.
- Rows are counted only once the tree's shape is sound, in every reader: a document whose shape is
  refused reports that, and not the bound as well. A kind nobody declared is a finding about one
  field and does not stop the count. `rows-lent-past-the-bound-beside-an-unsafe-row-key.json` pins it.
- Every reader applies the same count, defined as follows. A reader that does not expand rows
  computes it from its memo, saturating at the bound.
  - **Declared** is the number of JSON objects reached from `schema` through a group's `children`
    values and a collection's `item`, rows not read. A child under an unsafe key and a child that is
    not a node still count: they are objects the document wrote.
  - **Visits** is one per node taken off the walk: the schema, every child a group passes on (safe
    key, a node), every row of a collection (the rows its enclosing row wrote for it when that is an
    array, an object for a record, else the rows it declares; for a record, safe keys only), and a field the walk drops for its path or value.
  - **Templates share the budget.** Each distinct `item` is also walked once on its own, with no
    initial value, the first time its collection is reached; those visits count against the same
    budget, and a template's nested collections lend their declared rows there too.
  - Refused when visits exceed declared + 10,000. Visits equal to it are accepted.
  - `spec/fixtures/dynamic-form/v5/rows-lent-at-the-bound.json` is exactly at the bound and
    `spec/fixtures/dynamic-form/v5/rows-lent-past-the-bound.json` one past it, both within a hundred rows per collection.

## Consequences

- A table of a hundred rows and twenty cells (about 2,100 visits beyond its declarations) is
  accepted; a hundred lent rows of a hundred lent rows (about 10,200) is refused. A document as large
  as what it declares is never refused for its size: 30,000 flat fields parse.
- The bound is on visits, not bytes. A lent cell is shared by reference in TS (a 100,000-item
  multiselect cell lent to 2,400 rows: 60 ms, 12 MB heap); a reader that copies a cell per row must
  share it instead, or bytes multiply under a visit count that looks small. A shared value is one
  instance for every field that takes it, so Java hands it out unmodifiable: a write through one
  field cannot reach the others.
- `MdyDynamicSchemaLimitError` is a new export (`minor`), and a parser that refused nothing here
  now refuses: a document past the bound that parsed before is `ok: false`.
- The TS reader does not yet refuse more than 100 written rows per collection, which Java and Rust
  do. Until it does, the bound also counts written rows, so 10,001 written empty rows are refused by
  this rule in TS and by the row rule elsewhere. Both rules report `MDY_DYNAMIC_SCHEMA_LIMIT`; they
  differ in path (`/schema` here, the collection's `initialValue` there) and in what survives. The
  row rule is not yet recorded by any ADR; it lands in TS before or with the release that ships this
  bound.
  *Amendment, 2026-10-14:* [ADR 0232](0232-a-collection-writes-at-most-a-hundred-rows.md) records
  the row rule and TS applies it, at the collection's `initialValue` in every reader. More than 100
  written rows in one collection are now refused by that rule alone, as a finding about the shape,
  so this bound is never reached by written rows of a single collection.
- `MDY_DYNAMIC_SCHEMA_LIMIT` is shared. Java still reports it, at the node reached, for the depth
  (100) and node (500) caps ADR 0043 removed elsewhere; TS and Rust do not have those caps. A Java
  finding with this code is therefore not necessarily this bound: only one at `/schema` with no
  fields is. That difference is known and is not settled here.
- Written rows count too. A document that writes, explicitly, more than 10,000 visits beyond its
  declarations is refused although it paid for them in bytes. With a hundred rows per collection,
  that takes a hundred written rows of a hundred written rows.
- The runtime builder (`buildDynamicFormSchema` then `createForm`) does not lend: an outer row's
  nested collection starts empty. Lending is therefore a property of the reader and not of the
  runtime, and stopping it would align the reader to the runtime rather than change what a form
  holds. It is kept here because it changes the flattened fields of valid documents; whether the
  reader keeps lending is a separate decision, open, not settled by this one.
- This bound does not depend on that decision. Without lending, the visits beyond the declarations
  are the written rows and the templates, and the bound still holds them; a record that stops
  lending amends the consequences above, not this decision.

## Alternatives rejected

- **Count leaves only.** Falsified: rows ending in empty groups produce no field and cost the same
  walk (0.4 s at d=3, growing ×100 per level).
- **An absolute cap on total visits.** Refused a well-formed 99,999-field flat document the
  adversarial corpus accepts; the cost to bound is what rows multiply, not what is written.
- **Stop lending.** Changes valid documents' initial values under a security banner, and does not
  by itself bound a document that writes its rows at every level.
- **Restore a depth or node cap.** ADR 0043's reasoning still holds for written nesting; depth is
  not what multiplies here.
- **Truncate at the bound and accept the rest.** The part reached is an artefact of walk order.

## Verification

- `packages/core/test/dynamic-expansion-limit.test.mjs`: refusal at d=6 in both modes under 1 s,
  leafless rows refused, the exact bound accepted and one past it refused, 100×20 accepted, 30,000
  flat fields accepted, the typed error from the direct flatten. Removing the budget makes the suite
  hang; moving the comparison by one turns the boundary test red.
- `battle-tests/adversarial/dynamic-contract`: the 99,999-field document stays accepted.
- The shared corpus pair at and past the bound runs in every reader's corpus test, so a reader
  whose count drifts by one from this definition turns red.
- `node scripts/audit-type-surface.mjs`: the new export is in the baseline.
- `sdk/java/modyra-contract/src/test/java/dev/modyra/contract/MdyDynamicExpansionLimitTest.java`:
  the d=6 shape refused in both modes, leafless rows refused, the shared pair exact in both modes,
  100×20 accepted, a 100 KB multiselect cell lent to 2,000 rows held as one value, and a shared
  Jackson scalar judged under each cell's own kind. Moving the bound by one, converting the cell per
  row, or keying the cell by value alone each turns one of them red.
- `sdk/rust/modyra-contract/tests/expansion_limit.rs`: the d=6 shape refused in both modes with the
  schema dropped, d=40 (a product past `u64`) refused by saturation, leafless rows refused, a hundred
  written rows of a hundred written rows refused, 100×20 accepted. The corpus test holds Rust to the
  shared pair by exact code set; moving the bound by one, dropping the template term, or ignoring
  written rows each turns it red.
- `a-path-cannot-say-which-it-came-from` flattens every corpus document directly; it skips the one
  refused for its expansion, which has no paths to classify.

## Security and privacy

Trust boundary: any reader of a dynamic document from a CMS, a model or a server. Without the bound an
attacker sending about 1.6 KB exhausts a Java reader's heap and keeps a TS reader busy for seconds per
request, with growth ×100 per nesting level. The bound makes the work a constant plus a multiple of
the document. No data is exposed or stored. Disclosure: this record and its measurements are
published with the fix in all three readers, not before.
