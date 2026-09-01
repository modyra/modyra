# Writing a new reactivity adapter

`@modyra/core`'s form engine never imports a framework — it is written
against one minimal interface, `MdyReactivity` (`packages/core/src/reactivity.ts`).
Every framework package (`@modyra/angular`, `@modyra/vue`, `@modyra/solid`,
`@modyra/preact`, `@modyra/svelte`, `@modyra/lit`, `@modyra/react`) binds
that interface to its host framework's native signals. This guide is for
adding the next one.

The public protocol is defined by the exported interfaces and the conformance suite
(not committed — a local planning doc); this guide is the practical,
grounded-in-real-code version of it.

## 1. The minimum you must implement

```ts
export interface MdyReactivity {
  readonly id?: symbol;
  readonly kind?: string;
  readonly capabilities?: MdyReactivityCapabilities;
  signal<T>(initial: T, options?: MdySignalOptions<T>): MdyWritableSignal<T>;
  computed<T>(fn: () => T, options?: MdyComputedOptions<T>): MdySignal<T>;
  effect(fn: (onCleanup: MdyOnCleanup) => void, options?: MdyEffectOptions): MdyEffectRef;
  untracked<T>(fn: () => T): T;
  createScope?(options?: MdyScopeOptions): MdyReactiveScope;
}
```

Bind `signal`/`computed`/`untracked` to your framework's own primitives
directly — do not build a second reactive graph. `effect()` should use your
framework's real effect/watcher; if it needs a runtime context your
framework requires (an Angular `Injector`, for instance), accept it as a
constructor parameter and reflect its absence honestly (see §3).

Reference implementation: `vanillaReactivity()` in `packages/core/src/reactivity.ts`
— the only adapter without a host framework, used by Node, CLIs, tests,
and the React/Preact/Svelte bindings (none of which have a native signal
primitive of their own).

## 2. Declare declared capabilities — never a fictitious one

```ts
export interface MdyReactivityCapabilities {
  readonly effects: boolean;
  readonly effectOwnership: boolean;
  readonly signalEquality: boolean;
  readonly computedEquality: boolean;
  readonly batching: boolean;
  readonly deterministicFlush: boolean;
  readonly directObservation: boolean;
  readonly graphInspection: boolean;
  readonly serverSnapshots: boolean;
  readonly pureComputeds: boolean;
}
```

### What each one asserts, and what answering `false` costs

`false` is usually the truth and saying so is the point of the flags. What it is
not is free: every `false` buys a conformance check out of running, and two of
them change what the engine does. The three groups below cost very different
things, so they are worth telling apart before you answer.

**Read by the engine — answering changes behaviour.**

| flag | asserts | `true` | `false` |
| --- | --- | --- | --- |
| `effects` | reactions run when their dependencies change | an array field reconciles itself through an effect; devtools observe live | `_reconcile` is null and nothing watches for you — reconciliation has to be driven explicitly, and four conformance checks go unasked |
| `batching` | several writes in one block propagate once | the engine groups its writes through your `batch` | every write pays its own propagation. Declaring it `true` without a working `batch` is worse than `false`: intermediate states become observable |

**Read only by the conformance suite — answering costs you a check.**

| flag | asserts | what goes unchecked when `false` |
| --- | --- | --- |
| `signalEquality` | writing an equal value notifies nobody | that an identical write causes no recompute |
| `computedEquality` | a recomputation to an equal value does not propagate | that a chain of computeds stops at an unchanged value |
| `deterministicFlush` | there is a defined moment when pending effects have run | that "after the flush, X" holds — the suite waits for settling instead, which is slower and less precise |
| `directObservation` | a signal can be observed without an effect | that state can be read without mounting a reaction |
| `pureComputeds` | writing inside a computed is refused | that a write in a computed raises rather than creating a cycle nobody diagnoses |

**Read by nothing, today.**

| flag | asserts | why it is here |
| --- | --- | --- |
| `graphInspection` | the runtime can expose its dependency graph | the devtools panel is its intended consumer, and is planned for 3.0.0 |
| `serverSnapshots` | a coherent snapshot can be produced and restored outside a browser, with the same verdicts | the SSR path is its intended consumer, same release |
| `effectOwnership` | effects created in a scope die with the scope | **nothing reads it — not the engine, not the suite.** Every adapter declares it and no code consults it. Answer it honestly, and know that today the answer changes nothing |

The three in the last group are the ones to be most careful with, for opposite
reasons: the first two are promises whose consumers do not exist yet, so a `true`
there will be checked for the first time when they arrive; the third is measured
by nothing at all.

**Do not answer `true` out of ambition.** Conformance will check it and fail
loudly, which is the safe direction for the mistake. Answering `false` when the
guarantee is real is the quieter error: you keep a check that would have passed
from ever running, and the skipped-check report is the only place that shows.

A capability is `true` only when your adapter provides the **observable
guarantee**, not just a same-named method. Two examples from this
codebase, for contrast:

- Vanilla reports `computedEquality: false` even though its `computed()`
  accepts an `equal` option — the option lets the computed *reuse* an
  unchanged value's identity, but staleness already propagated to
  downstream consumers before the equality check runs (a consequence of
  vanilla's lazy dirty-flag design). Claiming `true` would be exactly the
  "fictitious capability" rule below forbids. See the comment above
  `computedEquality: false` in `reactivity.ts` for the full reasoning.
- Angular reports `effects`/`effectOwnership` as `injector !== undefined`
  — not always `true` — because effects do not run without one.
  See `packages/angular/src/lib/core/reactivity-angular.ts`.

Run `npm run docs:reactivity-matrix` to regenerate
`docs/reactivity-capability-matrix.md` from every adapter's real
`capabilities` object — this is how a reviewer checks your claims against
your code without reading the whole diff.

## 3. Never degrade silently

Forbidden:

```ts
effect() {
  if (!contextAvailable) return { destroy() {} }; // silent no-op
}
```

Two acceptable shapes instead (`packages/angular/src/lib/core/reactivity-angular.ts`
implements both, selectable via an `unsupported: "throw" | "report"` option):

1. **Throw a typed error** (the default) — `MdyUnsupportedCapabilityError`,
   `MdyDestroyedScopeError`, `MdyAdapterContractError`, `MdyActivationError`
   (all in `packages/core/src/reactivity-errors.ts`). The form engine checks
   `capabilities.effects` before calling `effect()` for its
   own features (async validators, drafts, history), so this path mostly
   protects against a caller that skipped that check.
`MdyCrossRuntimeObservationError` sits in the same file and is deliberately not in that list: it
is **constructed for its message and never thrown**. Observing a handle through a runtime that does
not own it is a stale read rather than a failure — the read still answers — so `observerFor` reports
it under `MDY_CROSS_RUNTIME_OBSERVATION` and returns the runtime it was given. Catching the class
waits for something that does not arrive; match on the diagnostic code instead.

2. **Report through `MdyDiagnostics`** (`packages/core/src/reactivity-diagnostics.ts`)
   — structured, with one of the `MDY_*` codes — and only fall back to a
   disabled ref if the caller explicitly opted into graceful degradation.
   Never `console.warn()` as the only signal.

## 4. Ownership: scope, not vibes

If your framework has no equivalent native ownership primitive, implement
`createScope()` yourself — see `VanillaScope` in `reactivity.ts`:
idempotent `destroy()`, parent→child cascade, `onCleanup()` throws
`MdyDestroyedScopeError` once destroyed. `MdyFormEngine` creates one root
scope per form (`_rx.createScope?.(...)` — optional, so adapters that
haven't implemented it yet keep compiling) and threads it into the
draft-write, history-snapshot and async-validator effects as a teardown
backstop. See `packages/core/test/reactivity-scope.test.mjs` for the
behavioral tests your `createScope()` must satisfy if you implement it.

## 5. Cross-runtime observation is a bug, not a shortcut

Never do this in a binding layer:

```ts
const rx = someOtherReactivity();
rx.effect(() => existingFormField.value()); // wrong runtime observes it
```

This was a real, if latent, bug found while auditing `@modyra/react` and
`@modyra/preact`'s `createStore()`: both used to build a fresh
`vanillaReactivity()` to observe a field handle, which happened to work
only because vanilla's dependency tracking is a module-global singleton —
it silently breaks the moment the handle belongs to a different runtime
(Vue, Solid, Angular). Fixed by tagging every handle with its owner
at construction time (`packages/core/src/reactive-owner.ts`,
`getFieldHandleOwner()`) and resolving through that instead of assuming
one. If you bridge a handle to your framework's own subscription
mechanism, resolve the owner the same way — never assume vanilla.

## 6. Prove it: the conformance suite

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runReactivityContractTests } from "@modyra/core/testing";
import { myFrameworkReactivity } from "../src/index.js";

runReactivityContractTests(test, assert, "my-framework", () => ({
  reactivity: myFrameworkReactivity(),
  flushIfSupported: () => Promise.resolve(), // or your framework's real flush
  destroy: () => {},
}));
```

This registers the shared Level-A suite (signal read/write/update,
computed caching, untracked reads, effect run/cleanup/destroy) plus every
capability-gated check your `capabilities`/`createScope` opt into
(skipped, not failed, if you haven't implemented them yet). See
`packages/core/test/reactivity.test.mjs` for the minimal call, and
`packages/angular/src/lib/core/reactivity-angular.spec.ts` for a fuller,
framework-specific spec on top (Angular's whole suite runs under Jest, not
`node --test`, so it hand-writes the same assertions rather than calling
`runReactivityContractTests` directly — a real cross-runner constraint,
not an oversight; match whichever your framework's own test tooling needs).

## Checklist before calling an adapter done

- [ ] `capabilities` reflects real, tested guarantees — run `npm run docs:reactivity-matrix` and read your row.
- [ ] No effect ever returns a silent no-op for a requested feature.
- [ ] `createScope()` implemented (or explicitly deferred, documented, with `createScope` left `undefined`).
- [ ] No binding constructs an unrelated reactivity instance to observe a handle it doesn't own.
- [ ] `runReactivityContractTests` passes (or your framework-native equivalent, if your test runner can't call it directly).
- [ ] `destroy()`/scope teardown is idempotent and leak-tested under churn (see `packages/core/test/lifecycle.test.mjs` for the pattern: hundreds of create/destroy cycles, assert zero leaked timers).
- [ ] Equality (`options.equal`) is either really propagated to your native primitive, rejected explicitly, or documented as best-effort — never silently ignored.
