# ADR 0040: A collection owns its subtree

Status: Accepted

## Context

An array or a record may hold fields and groups. It may not hold another collection: an order with
lines, a row with its own allocations, cannot be expressed. The refusal is explicit —
`assertNotNestedCollection` in the array manager, `assertRowNode`/`assertRowShape` in the record
manager — and it fires when the form is *built*, not when a row arrives, which is the one property
of the current state worth keeping.

The restriction cannot simply be lifted. Three things underneath it assume one level:

**Path gates resolve by the first prefix that matches.** The engine iterates its gate map and
returns on the first prefix covering a path. With one collection that is the collection. With two,
`orders` and `orders.order-1.lines` both match, and the answer is whichever registered first —
neither the innermost nor the outermost, but an accident of construction order. A child gate
registered first would admit a path its closed parent refuses.

**The schema walk stops at a collection.** `walkSchema` reports an array or a record and does not
descend into its item, so a collection declared inside a row is invisible to everything built from
that walk.

**The handle types say `never`.** `MdyItemHandleTree` and `MdyArrayItemValue` map a group or a field
and nothing else, so recursion is not merely unimplemented — it is unrepresentable.

## Decision

**A collection owns the whole subtree below it, and existence is decided by every ancestor.**

- **Ownership is explicit, not derived from a string.** A runtime knows its owner — the form, a
  record row, an array row — so destruction, rename, move and reset follow the tree rather than
  re-parsing paths.
- **A path is in play only if every collection above it admits it.** Gates compose along the chain;
  no gate short-circuits the ones outside it. *Out of play if any of them says no* is already the
  rule for sections (ADR 0030) and this is the same rule with a different set of ancestors.
- **Registration is one recursive visit**, shared by both managers, not one per manager.
- **A supported shape is decided when the form is built.** A combination the runtime cannot execute
  fails at construction, never by producing paths that look valid.

Eight questions the implementation cannot avoid, decided here:

| | Decision | Why |
|---|---|---|
| `patch` vs `setAll` | `patch` merges, `setAll` replaces | Already what `MdyRecordHandle` documents at one level: `patch` is "several rows in one write", `setAll` "declares exactly these keys, removing the rest". Nothing new is being chosen |
| `rename` and server errors | Cleared | An error attributed to a path is a statement about a value at a moment. A new key is a new identity, and carrying the error across would require a value snapshot that does not exist |
| Maximum depth | 6, the document's existing cap | A second limit in the same engine is a limit someone reads wrong |
| `array → record` | Rebuild atomically | An array row's identity is positional: `insert`, `remove` and `move` change every descendant's prefix. Rebasing would preserve flags the array does not promise anyway. What is lost is documented rather than discovered |
| First public combination | `record → record` | The only one where both levels have declared identity, so rename and late binding are verifiable without a rebase |
| Dynamic Form Contract | Same major, after the core | The parser must not accept a shape the runtime cannot execute |
| `getChanges()` | Represents structural change | A declared, empty row is a change to the form's shape; a consumer sending only changed leaves would drop the row itself |
| `when` inside a nested collection | Composes every ancestor | ADR 0030's rule, and the section conditions are already threaded down to a collection today |

## Consequences

Every collection operation becomes a subtree operation, which is more expensive and more correct: a
`remove` that took a row now takes everything the row owned, and there is no cheap version.

The gate chain adds a per-ancestor check to a path decision that was one lookup. For a form with no
nested collections that is one iteration over a map with one entry — but it is on the path every
control mounts through, so it is measured rather than assumed.

Deciding `rename` clears server errors means a rename after a failed submit loses the messages. That
is visible and it is the honest reading: those errors described the value under the old key.

`array → record` losing flags on a `move` is a real cost, accepted because the alternative is to
promise stability the array's own contract never promised.

## Alternatives rejected

**Longest-prefix wins for gates.** Reads as the obvious fix and lets a child admit a path its parent
refuses — the exact bypass the composition exists to prevent.

**One manager per collection *path*, keyed by string.** What the code does today at one level. With
dynamic paths it makes ownership a parsing problem, and every operation re-derives what the tree
already knows.

**Lift `assertRowShape` first and fix what breaks.** The shortest route to a form that produces
paths nobody owns. The guard goes last, when the runtime beneath it can answer.

**Allow every combination at once.** `array → array` has no worked use case here, and each
combination brings its own rebase question. A recursion nobody asked for is surface that 1.0 has to
keep stable.

## Verification

- `packages/core/test/nested-collections.test.mjs` — the characterization suite: what the refusal
  does today, and the scenarios each phase must satisfy, skipped until the phase that answers them.
- `npm run test:import-cycles` — the shared registration module must not close a ring with the
  managers that use it.
- `npm run test:type-surface` — widening `MdyItemHandleTree` and `MdyArrayItemValue` is a public
  change and is classified rather than slipped in.
- `npm run test:core` — the collection host double keeps passing unchanged, which is what says the
  new runtime went behind the existing contract instead of around it.

## Security and privacy

Path safety is the whole of it. Every dynamic segment at every depth goes through `isSafeFieldPath`,
so `__proto__`, `prototype`, `constructor` and a segment containing `.` are refused as they are
today — at each level, not only the first. The depth cap is the other half: a document from a
network describing a thousand-deep nesting is refused at parse rather than allocated. Neither is a
new boundary; both are existing boundaries that now have more places to hold.
