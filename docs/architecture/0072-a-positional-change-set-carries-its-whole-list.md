# ADR 0072: A positional change set carries its whole list

Status: Accepted

## Context

`getChanges()` is documented as *"ready for an API PATCH request"*. For a keyed collection it composes
into something a server can act on — the row is named:

```js
form.f.rows.cell("c", "t").set("EDITED");
form.getChanges();   // { rows: { c: { t: "EDITED" } } }
```

For a positional one it was a **compacted** list of the rows that changed, with nothing saying where
they were:

```
edit index 0   { list: [{ t: "EDITED" }] }
edit index 1   { list: [{ t: "EDITED" }] }    the same body
edit index 2   { list: [{ t: "EDITED" }] }    the same body
edit 0 and 2   { list: [{ t: "A" }, { t: "C" }] }   reads as 0 and 1
```

A server applying it by position wrote the wrong row in two cases out of three.

The information was not missing — it was dropped one step from where it was known. The comparison
itself is careful: a row is compared against its **own** initial rather than against whatever now
sits at its index, so removing a row does not report every row after it as changed. What is lost is
only the position, in the flattening.

Three shapes could carry it, and two are excluded:

| shape | addressable | minimal | matches `MdyFormPatch` |
| --- | --- | --- | --- |
| the whole list | yes | no | yes — the array branch is whole-item |
| an object keyed by index | yes | yes | no — it stops being an array |
| a compacted list | **no** | yes | yes |

## Decision

**A positional collection with any change is carried whole.** Every row of it, in order, so the
position of the ones that changed is readable.

**An index is the identity of a positional row**, so a partial list is not a partial PATCH — it is an
ambiguous one. Minimal and addressable cannot both hold for a JSON array, and between them
addressable wins: sending untouched rows is a cost that can be measured, and writing the wrong row on
a server is a cost nobody measures until it is too late, and nobody attributes to `getChanges`.

**A keyed collection is unchanged.** Its rows are addressed by key, so a partial object is both
minimal and addressable, and it stays deep-partial exactly as `MdyFormPatch` declares.

**The comparison is untouched.** What is added is the rows that did *not* change; how change is
decided — `Object.is` against each row's own initial — is the same.

## Consequences

A PATCH carrying a positional collection grows: every row travels whenever one of them changed. For
a long list that is real traffic, and it is visible in a network tab the day somebody looks — which
is the property that made it the better half of the trade.

A consumer diffing `getChanges()` output across versions sees positional collections change shape
from "the rows that moved" to "the list". Nothing published described the old shape; the type already
declared the new one.

Nested positional collections are carried the same way, and the concrete path is recovered by walking
the schema's patterns rather than by guessing from a segment: `orders.a.lines` is an array under a
record whose key does not look like a key, and a group named `0` must not be read as a row.

## Alternatives rejected

**An object keyed by index.** It is addressable *and* minimal, and it stops being an array — changing
the published `MdyFormPatch` shape to solve a problem the shape already solves by declaring
whole-item.

**Document that a positional change set is not addressable**, and tell callers to send the whole list
themselves. It is a documentation repair with a live consequence: every consumer has to know, and the
ones who do not keep writing the wrong row.

**Carry an index alongside each row.** A row shaped `{ index, …fields }` is not the row's own shape,
so a server would have to strip it, and the collection's cells and the marker share one namespace.

## Verification

- `battle-tests/adversarial/submission/a-patch-that-cannot-say-which-row.battle.test.mjs` — three edits
  at three indices producing three different bodies, with a keyed collection beside them as the shape
  that was already right.
- `battle-tests/adversarial/submission/partial-rows.battle.test.mjs` — a field nobody touched stays
  out of the change set, which is what "the change set is what moved" still means.

## Security and privacy

A PATCH now carries rows the person did not edit. They are values the form already holds and the
server already has, and they travel to the same place the changed rows do — but a consumer relying on
`getChanges()` to *minimise* what leaves the browser should know that a positional collection now
sends all of it.
