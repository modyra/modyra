---
"@modyra/core": minor
"@modyra/angular": minor
"@modyra/zod": minor
---

A nested collection reaches every package that restates it

`@modyra/core` allows a collection inside a collection at any depth. Three packages a consumer
imports could not express that, and their suites were green throughout.

**`@modyra/angular`** re-declares `array()` and `record()` so their handles carry Angular signals, and
both still constrained a row to a field or a group:

```ts
array(group({ lines: array(group({ sku: field("") })) }))  // ok in @modyra/core, refused here
```

They now take what the engine's take. The refusal bites when a row **is** a collection — a collection
inside a group inside a row was always legal, since a group's children have always been able to hold
one. `@modyra/studio-target-angular` generates code against these factories, so a project whose row
is a collection generated Angular code that did not compile.
`MdyAnyRowDescriptor`, `MdyAnyRecordDescriptor`, `MdyRecordDescriptor` and `MdyRecordHandle` are
exported too: the array half was nameable and the record half was not.

**`@modyra/zod`** mapped a collection's element to a group or a leaf, so `z.record(z.array(...))` and
`z.array(z.array(...))` became one opaque value where the schema declared a list. A row is now read
exactly like a schema key. Shapes the engine has no node for — tuple, set, map — still degrade to a
leaf.

**A document made of arrays** built a form whose nested collections held no rows. A row's value
arrives flat, so a collection inside it is keyed `"0"`, `"1"` — what a record holds and what an array
refuses — and `buildFlatFormSchema` seeded it unchanged. The value read as correct in structure and
was empty in fact: `@modyra/plain` mounted one control out of three for a three-level document.
Seeds are now shaped against the descriptor at every depth, so a list inside a keyed row and a keyed
row inside a list each keep their own shape.

**`MdyAnyRowDescriptor` is exported** from `@modyra/core`: it is the constraint of the public
`array()` and `record()` factories, and a consumer writing a helper over row descriptors could not
name it.

**A nested collection's value now has the same type as a top-level one.** `MdyArrayItemValue`
returned `ReadonlyArray` and `Readonly<Record>` for a collection directly inside a collection while
`MdyFormValue` returned mutable ones a level up — the same value, two types depending on the depth it
was read at. Nothing changes at runtime; a nested list is no longer typed readonly.

Recorded as [ADR 0046](https://github.com/modyra/modyra/blob/main/docs/architecture/0046-an-adapter-states-no-less-than-the-engine.md).
