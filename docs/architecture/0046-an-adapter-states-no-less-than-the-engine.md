# ADR 0046: An adapter states no less than the engine

Status: Accepted

## Context

[ADR 0043](0043-a-collection-nests-without-a-limit.md) removed the one-positional-level rule from
`@modyra/core`. Every check in the workspace stayed green, and three of the packages a consumer
actually imports could not express what the engine had gained:

- `@modyra/angular` re-declares `array()` and `record()` so their handles carry Angular signals. The
  declarations still constrained a row to a field or a group, so `array(array(field(0)))` compiled
  against `@modyra/core` and was refused by `@modyra/angular`. It bites when a row **is** a
  collection; a collection inside a group inside a row was always legal, because a group's children
  have always been able to hold one. `@modyra/studio-target-angular` generates code against these
  factories, and the studio model lets a row be a collection, so such a project generated Angular
  code that did not compile:

  ```
  form.ts(28,17): error TS2345: Argument of type 'MdyArrayDescriptor<MdyFieldDescriptor<number>>'
    is not assignable to parameter of type 'MdyAnyFieldDescriptor | MdyAnyGroupDescriptor'.
  ```
- `@modyra/zod` mapped a collection's element to a group or a leaf, so `z.record(z.array(...))`
  became one opaque value where the schema declared a list.
- A document made of arrays reached `buildFlatFormSchema` with its rows keyed `"0"`, `"1"` — a row's
  value is flat, and nothing shaped it back into a list. The descriptor said `array`, the seed said
  object, and the collection started with no rows: `@modyra/plain` mounted one control out of three
  for a three-level document whose value looked structurally correct.

None of this was visible from the engine's own suite, because the engine was right. It was visible
from a consumer, which is where the promise is actually made.

The same shape appeared once already, from the other side: `@modyra/solid` could not declare a row
with more than one cell while `test:adapters` was green, because no adapter suite had ever declared a
collection.

## Decision

**A capability the engine gains is not shipped until every package that restates it has it.** An
adapter that re-declares a factory, a descriptor type, a handle type or a schema mapping is part of
that capability's surface, and a release in which the engine accepts what an adapter refuses is
incomplete rather than staged.

Concretely, for each change to a public contract in `@modyra/core`:

- every package that names the changed type or re-declares the changed function is checked, and
  adjusted in the same change;
- the check is a **consumer program**, not a passing suite — the smallest form a user would write,
  built and run through the adapter's own entry point;
- the adapter's own suite gains the case, so the next change trips over it there.

**A nested collection's value has the same type as a top-level one.** `MdyArrayItemValue` returned
`ReadonlyArray` and `Readonly<Record>` for a collection directly inside a collection while
`MdyFormValue` returned mutable ones a level up, so the same value had two types depending on the
depth it was read at.

## Consequences

A core change that touches a contract now costs an adapter pass. That is the cost of the adapters
restating anything at all, and restating is not free to remove: Angular's factories exist because its
handles carry Angular signals, and its consumers' types depend on that.

Mutable nested values match what a form already returns at the top level, and remove the readonly
guarantee a consumer might have been leaning on for a nested list. The value has always been a fresh
object the caller owns; nothing else changes.

`test:adapters` now declares collections on every headless adapter, which makes it slower and makes
it a guard.

## Alternatives rejected

**Let adapters lag by a release.** It is what happened, and what it produces is a consumer who reads
the engine's documentation and cannot compile the example. A capability nobody can reach is not
shipped.

**Stop restating: have every adapter re-export the engine's factories.** Right for the packages that
already do it (`@modyra/react` re-exports `*`), and wrong for Angular, whose whole reason for
existing is handles carrying that framework's signals. The restatement is the feature.

**Generate the adapter surfaces from the engine's.** A real option, and much larger than this
decision: it needs a generator, a review story for its output, and a build step in every adapter. Not
justified by three sites; worth revisiting if a fourth kind of drift appears.

## Verification

- `packages/angular/src/lib/core/typed-form.types.spec.ts` — a positional collection nested three
  deep, an array of arrays, and a record of arrays declared through `@modyra/angular`'s own
  factories, with the value types asserted.
- `packages/zod/test/zod.test.mjs` — a collection inside a collection maps to a collection, in both
  kinds, and the shapes the engine has no node for still degrade to a leaf.
- `packages/studio-target-angular/test/angular-target.test.mjs` — a project whose row is a collection
  generates Angular code that compiles against the built adapter declarations. The existing typecheck
  used a fixture holding one flat array, which no adapter constraint could refuse.
- `packages/core/test/flat-schema.test.mjs` — a positional collection inside a row is seeded as a
  list; a list inside a keyed row and a keyed row inside a list keep their own shapes.
- `packages/plain/test/nested-mount.test.mjs` — a field three positional collections deep mounts a
  control and typing reaches its cell.
- `packages/lit/test/record-cells.test.mjs` — an element bound inside a list inside a list follows a
  reorder above it.
- `packages/{vue,react,preact,svelte}/test/reactivity.test.mjs`, `packages/solid/test/solid.test.mjs`
  — each adapter declares a collection on its own reactivity.

No audit enforces the rule itself. `scripts/audit-type-surface.mjs` classifies interfaces, type
aliases and functions, so a widened factory constraint is visible to it; a member added to an
exported **class** is not classified by it or by `contract:diff`, which leaves the largest part of
this surface guarded by review alone.

## Security and privacy

None directly. Indirectly, the flat-seed defect is the shape a security defect takes: a value that
reads as correct while the structure behind it is empty, so a consumer's own check on the value
passes and the form it renders is not the form the document described.
