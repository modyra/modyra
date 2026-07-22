# Writing a new reactivity adapter

`@modyra/core`'s form engine never imports a framework — it is written
against one minimal interface, `MdyReactivity` (`packages/core/src/reactivity.ts`).
Every framework package (`@modyra/angular`, `@modyra/vue`, `@modyra/solid`,
`@modyra/preact`, `@modyra/svelte`, `@modyra/lit`, `@modyra/react`) binds
that interface to its host framework's native signals. This guide is for
adding the next one.

The full protocol spec lives in `.modyra/piano-modyra-reactivity-adapter-api.md`
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
  /** @deprecated alias — keep equal to capabilities.effects */
  readonly canEffect: boolean;
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

## 2. Declare real capabilities — never a fictitious one

```ts
export interface MdyReactivityCapabilities {
  readonly effects: boolean;
  readonly effectOwnership: boolean;
  readonly signalEquality: boolean;
  readonly computedEquality: boolean;
  readonly batching: boolean;
  readonly deterministicFlush: boolean;
  readonly directObservation: boolean;
  readonly writableComputed: boolean;
  readonly graphInspection: boolean;
  readonly serverSnapshots: boolean;
}
```

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
  — not always `true` — because effects genuinely don't run without one.
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
   `MdyCrossRuntimeObservationError`, `MdyDestroyedScopeError`,
   `MdyAdapterContractError`, `MdyActivationError` (all in
   `packages/core/src/reactivity-errors.ts`). The form engine checks
   `capabilities.effects`/`canEffect` before calling `effect()` for its
   own features (async validators, drafts, history), so this path mostly
   protects against a caller that skipped that check.
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
(Vue, Solid, Angular). Fixed by tagging every handle with its real owner
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
- [ ] No effect ever returns a silent no-op for a genuinely requested feature.
- [ ] `createScope()` implemented (or explicitly deferred, documented, with `createScope` left `undefined`).
- [ ] No binding constructs an unrelated reactivity instance to observe a handle it doesn't own.
- [ ] `runReactivityContractTests` passes (or your framework-native equivalent, if your test runner can't call it directly).
- [ ] `destroy()`/scope teardown is idempotent and leak-tested under churn (see `packages/core/test/lifecycle.test.mjs` for the pattern: hundreds of create/destroy cycles, assert zero leaked timers).
- [ ] Equality (`options.equal`) is either really propagated to your native primitive, rejected explicitly, or documented as best-effort — never silently ignored.
