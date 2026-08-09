# ADR 0026: A row exists because it was declared

Status: Accepted

## Context

A form's shape had two recursive nodes: `group()`, whose keys are known when the code is written, and
`array()`, whose keys are positions. A third case is as ordinary as either — a collection keyed by a
value the domain owns, `Record<string, RowFields>` — and `array()` cannot serve it, for three reasons
that are properties of what an array is rather than gaps to be filled in:

An array **wants an index**, and an entity id or a provisional key is not a position. It **wants the
controls of a row mounted together**, while a table that renders column by column mounts one cell of
one row at a time, in different places in the tree and at different moments. And it **wants to know
which rows exist** — which, if existence is decided by what happens to be mounted, means that
sorting, filtering or collapsing a table edits the data.

That last one is the pressure. Where the order comes from outside the form — a sort, a filter — an
index is not even stable: the same row changes path, and with it its value, its `touched` and its
errors.

The question a keyed collection has to answer first is therefore not how to store rows. It is **what
makes a row exist**.

## Decision

**A row exists because it was declared.** `upsert(key, value?)` brings it into being and
`remove(key)` ends it. A control that mounts claims; a control that unmounts releases. Neither
creates nor destroys a row.

Three rules follow, and they are the contract rather than an implementation detail:

1. **A claim on an undeclared key waits.** It is not an error and, above all, it does not declare the
   row — that would return existence to the rendering by another door. The control renders empty,
   binds when the key arrives, and says so in a development diagnostic.
2. **`remove(key)` takes the value, whatever is mounted.** Claims still held go back to waiting.
   Deletion is the owner's word; a control neither prevents it nor survives it.
3. **Validity belongs to the declared row.** Validators are registered when the row is declared, so a
   form holding an invalid row stays invalid however few of its controls are on screen.

The engine enforces the first two with a **path gate**: a prefix, and a predicate that says whether a
path below it may exist yet. `MdyFormEngine.claimField` holds a refused claim instead of creating a
field, `getField` answers `null`, and releasing the last claim inside a gated collection does not
destroy the field — the owner does.

A key is one path segment: no `.`, and the path grammar that keeps `__proto__` out. Keys that look
like indices are ordinary, so a record path is where index-to-array conversion stops.

## Consequences

The caller must say which rows exist. Code that today derives rows from a flat map or from what it
renders has to name them — usually the same statement it was already making, in a better place.

Ordering is now the awkward part, and it is where this can break in production: a control can mount
before the row it belongs to, because a table decides when to render and the application decides when
to declare. That is why waiting is a defined state rather than an error, and why two of the nine
acceptance checks are about arrival order.

The gate adds a branch to the engine's hottest write paths (`claimField`, `getField`, `_getOrCreate`).
It costs a map lookup per call when no gate is registered, which is every form that has no record.

A record cannot nest inside an array or another record, and vice versa. The nesting is refused when
the form is built, with a message, rather than producing paths that read plausibly and address
nothing.

What is bought: a table can render column by column, be sorted and filtered by anything, and hide
rows, without any of it touching the data or the validity. That was not expressible before.

## Alternatives rejected

**The row is born from the first claim and outlives the last release.** No caller has to declare
anything, which is why it is tempting. It requires the engine to hold a value with no claim on it,
and then to answer "when does that value die" — a question with no good answer: at unmount it loses
work, never is a leak, and any timer is arbitrary. The declared row makes the question disappear
instead of answering it.

**Keying an array by a hidden id column.** Rows stay positional and the id rides along. Every
structural operation still renumbers paths, so `touched` and errors follow the position rather than
the row, which is the defect that started this.

**A record node in the data-only Dynamic Form Contract, at the same time.** Worth doing, and a much
larger public surface — schema, parser diagnostics, conformance fixtures, three renderers. It is a
separate decision, taken separately.

## Verification

- `packages/core/test/record-fields.test.mjs` — sixteen checks over the rules above, including the
  two orderings: a claim before its `upsert`, and a `remove` while controls are mounted.
- The one that would have failed before anything else: a record keyed `"0"` and `"12"` reads back as
  an object. `numericKeysToArrays` stops at record paths, and the test asserts the shape rather than
  the conversion, so the guarantee survives a rewrite of how it is done.
- Validity is asserted twice on purpose: once with nothing mounted, once across a mount/unmount
  cycle. A validity that quietly followed the rendering would pass the first and fail the second.
- `npm run test:core`, `test:adapters`, `test:widgets`, `test:angular`, `test:contracts`.

Unguarded: drafts and history restore a flat value straight into the engine, so a record's rows are
not declared by that path. A restored draft currently comes back with its rows absent rather than
half-formed — the gate refuses the paths — which is safe but not yet right, and is the next batch's
first item.

## Security and privacy

Keys arrive from outside — a server response, a URL, a file. They are path segments, so they inherit
`isSafeFieldPath`: `__proto__`, `prototype` and `constructor` cannot become keys, and a key carrying
`.` is refused rather than silently addressing a different depth. A refused key is reported and
dropped, because a form that throws on a hostile row hands the caller a denial of service in place of
a defence.

The gate reduces exposure in one more way: a control can no longer bring a field into existence by
mounting, so a rendered path cannot extend the value a form submits.

No user data is stored or transmitted by any of this.
