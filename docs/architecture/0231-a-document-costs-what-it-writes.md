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
| Rust | any | — | no row expansion; bounded by a memo |

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
- Every reader applies the same count. A reader that does not expand rows computes it from its
  memo, saturating at the bound.

## Consequences

- A table of a hundred rows and twenty cells (about 2,100 visits beyond its declarations) is
  accepted; a hundred lent rows of a hundred lent rows (about 10,200) is refused. A document as large
  as what it declares is never refused for its size: 30,000 flat fields parse.
- The bound is on visits, not bytes. A lent cell is shared by reference in TS (a 100,000-item
  multiselect cell lent to 2,400 rows: 60 ms, 12 MB heap); a reader that copies a cell per row must
  share it instead, or bytes multiply under a visit count that looks small.
- `MdyDynamicSchemaLimitError` is a new export (`minor`), and a parser that refused nothing here
  now refuses: a document past the bound that parsed before is `ok: false`.
- The TS reader does not yet refuse more than 100 written rows per collection, which Java and Rust
  do. Until it does, the bound also counts written rows, so 10,001 written empty rows are refused by
  this rule in TS and by the row rule elsewhere.
- The runtime builder (`buildDynamicFormSchema` then `createForm`) does not lend: an outer row's
  nested collection starts empty. The parser and the runtime therefore disagree on what a lent row
  holds. That disagreement predates this decision and is not settled by it.

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
- `node scripts/audit-type-surface.mjs`: the new export is in the baseline.
- Java and Rust: not yet implemented; their checks are owed with them.

## Security and privacy

Trust boundary: any reader of a dynamic document from a CMS, a model or a server. Without the bound an
attacker sending about 1.6 KB exhausts a Java reader's heap and keeps a TS reader busy for seconds per
request, with growth ×100 per nesting level. The bound makes the work a constant plus a multiple of
the document. No data is exposed or stored. Disclosure: this record and its measurements are
published with the fix in all three readers, not before.
