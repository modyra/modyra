# @modyra/core

**Framework-agnostic, type-safe form engine.** Typed field trees,
sync/async/cross-field validation, dirty/touched tracking, draft
persistence, undo/redo and minimal-patch change tracking — with zero
dependencies and no framework in sight.

```ts
import { createForm, field, group, required, min } from "@modyra/core";

const form = createForm({
  email: field("", [required()]),
  age: field<number | null>(null, [min(18)]),
  address: group({ city: field("Rome") }),
});

form.f.email.set("foo@bar.com");
form.f.email.errors();        // []
form.getValue().address.city; // typed — typos do not compile
```

Runs in Node, CLIs, workers and plain unit tests.

## The reactive contract

The engine is written against four primitives — `signal`, `computed`,
`effect` (with cleanup) and `untracked` — the common denominator of
fine-grained reactivity (Solid, Preact Signals, Vue, Angular Signals, and
the TC39 Signals proposal). It is **not** an Angular API: Angular is just
one binding of the contract.

- **Angular** — `@modyra/angular` passes native Angular signals, so form
  state participates in change detection (zoneless included).
- **Vue** — `ref`/`computed`/`watchEffect` map 1:1 (wrap `.value` access).
- **Solid** — `createSignal`/`createMemo`/`createEffect` map directly.
- **React** — has no signal primitive: an adapter runs the engine on the
  built-in `vanillaReactivity()` and subscribes components via
  `useSyncExternalStore`.

`vanillaReactivity()` ships in this package: a dependency-tracked graph
with lazy computeds and microtask-batched effects, used when no framework
is around.

## Status

Extracted from the Modyra Angular library; the Angular package delegates
to this engine, so both share one implementation. React/Vue adapters are
future work — the contract above is the interface they will implement.
