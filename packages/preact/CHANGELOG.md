# @modyra/preact

## 0.5.0

### Patch Changes

- Updated dependencies [6f09012]
- Updated dependencies [969c08f]
- Updated dependencies [29621a7]
- Updated dependencies [602ac27]
- Updated dependencies [2c6a57f]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [cd22e96]
- Updated dependencies [33679ba]
- Updated dependencies [1d3a104]
- Updated dependencies [e5eb12d]
- Updated dependencies [c2fc744]
- Updated dependencies [808293d]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [4751929]
- Updated dependencies [18929b0]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [8279dc3]
- Updated dependencies [f580d4b]
- Updated dependencies [8e1164f]
- Updated dependencies [db0c39a]
- Updated dependencies [daaabe1]
- Updated dependencies [3f2e9d0]
- Updated dependencies [a8606da]
- Updated dependencies [ba52f67]
- Updated dependencies [f5ee72d]
- Updated dependencies [c170cf3]
- Updated dependencies [6bdfb02]
- Updated dependencies [a0559ec]
- Updated dependencies [351c0ed]
- Updated dependencies [6f6ed4e]
- Updated dependencies [f93c8cd]
- Updated dependencies [ebfa0ca]
- Updated dependencies [4803d30]
- Updated dependencies [8e1dc80]
- Updated dependencies [d9e424a]
- Updated dependencies [d21390f]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [9d7b426]
- Updated dependencies [e4ff1ac]
- Updated dependencies [26017d8]
- Updated dependencies [e0a4cef]
- Updated dependencies [5dbf493]
- Updated dependencies [a3c662e]
- Updated dependencies [1523836]
- Updated dependencies [e7f3189]
- Updated dependencies [fc6327f]
- Updated dependencies [0bd898d]
- Updated dependencies [7a574d1]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [8b87472]
- Updated dependencies [5b34979]
- Updated dependencies [3acc9bf]
- Updated dependencies [88b57b4]
- Updated dependencies [b3aa842]
- Updated dependencies [d32694a]
- Updated dependencies [f7e0c7c]
- Updated dependencies [62575e9]
- Updated dependencies [f998046]
- Updated dependencies [f759e3d]
- Updated dependencies [df563d4]
- Updated dependencies [6d000c1]
- Updated dependencies [1644bf5]
- Updated dependencies [026cf08]
- Updated dependencies [ec3d8ca]
- Updated dependencies [a613ac8]
- Updated dependencies [cf497e7]
- Updated dependencies [e403b6d]
- Updated dependencies [1008e4e]
- Updated dependencies [f7e0c7c]
- Updated dependencies [095fff8]
- Updated dependencies [77f2095]
- Updated dependencies [92d6155]
- Updated dependencies [4b2560b]
- Updated dependencies [d981a2f]
- Updated dependencies [6bff3da]
- Updated dependencies [bbb575e]
- Updated dependencies [8061d1d]
- Updated dependencies [de65e03]
- Updated dependencies [93a65aa]
- Updated dependencies [2388e2a]
- Updated dependencies [cf9b772]
- Updated dependencies [dc7acff]
- Updated dependencies [e6e592d]
- Updated dependencies [3846236]
- Updated dependencies [c136ad1]
- Updated dependencies [0b4298b]
- Updated dependencies [847f436]
- Updated dependencies [9b2646a]
- Updated dependencies [fd6e967]
- Updated dependencies [4206be3]
- Updated dependencies [b4b236d]
- Updated dependencies [9c8a238]
- Updated dependencies [d91dca1]
- Updated dependencies [ff10fc7]
- Updated dependencies [d17ea98]
- Updated dependencies [0310e27]
- Updated dependencies [5a66c4a]
  - @modyra/widgets@0.5.0
  - @modyra/core@0.5.0

## 0.4.0

### Minor Changes

- 1bb844f: Reactivity/adapter API redesign (`piano-modyra-reactivity-adapter-api.md`), all additive:

  - `MdyReactivity` gains optional `id`/`kind`/`capabilities` (honest, per-adapter, never claiming an unimplemented guarantee), `createScope()`/`MdyReactiveScope` (ownership with idempotent, cascading destroy), typed errors (`MdyUnsupportedCapabilityError`, `MdyCrossRuntimeObservationError`, `MdyDestroyedScopeError`, `MdyAdapterContractError`, `MdyActivationError`) and structured diagnostics (`MdyDiagnostics`, `MDY_*` codes). `canEffect` stays as a deprecated alias.
  - `vanillaReactivity()` is the reference implementation: real `batch()`, `flush()` and `observe()` (a selector-based subscription that only fires on an actual change), built on a redesigned shared-drain effect scheduler that settles chained effect triggers within one flush/batch instead of needing one microtask per hop.
  - `MdyFormEngine`/`MdyTypedFormBase` gain `form.mutate(fn)` — coalesces a burst of field writes into exactly one history entry regardless of whether the adapter's effects run synchronously (Vue/Solid) or are scheduler-deferred (vanilla/Angular); delegates to a real runtime `batch()` when the adapter reports it.
  - `MdyFormEngineOptions.autoActivate` (default `true`, unchanged behavior) plus `activate()`/`deactivate()`: pause/resume draft persistence, history recording and async validators without losing any state (field values, undo/redo stacks, draft baseline). `@modyra/react` and `@modyra/preact`'s `useMdyForm` now construct with `autoActivate: false` and call `activate()`/`deactivate()` from their effect instead of destroying on unmount — tolerant of React/Preact Strict Mode's dev-only double-invoke and safe during SSR (activation only ever runs client-side). **Behavior note**: the hook no longer calls `form.destroy()` automatically on unmount; call it yourself if you need a hard, final teardown (releasing field records) rather than a pause.
  - `@modyra/angular`'s adapter hardened: `effect()` without an `Injector` now throws a typed error by default instead of returning a silent no-op (`unsupported: "report"` opts back into graceful, diagnosed degradation); declared capabilities; `equal` propagated to Angular's native `signal()`/`computed()`; `onError` now actually respected (previously silently ignored).
  - Fixed a real, if latent, bug in `@modyra/react`/`@modyra/preact`: `createStore()` used to build a fresh `vanillaReactivity()` to observe a field handle, which happened to work only because vanilla's tracking is module-global — it silently never re-rendered for a handle owned by a different adapter's form. Now resolves the owner via a new handle-ownership registry (`getFieldHandleOwner()`).
  - Fixed a real pre-existing bug found while building `mutate()`: `undo()`/`redo()` restore a value through the same non-atomic multi-field write path `mutate()` guards against, so a synchronous-effect adapter could see 1-2 spurious extra history entries mid-restore.
  - Fixed a scheduler bug found while auditing error handling: an effect throwing without `onError` used to abort the shared drain loop, silently starving sibling effects scheduled in the same batch.
  - New `@modyra/core/testing` subpath (`runReactivityContractTests`, `MdyReactivityTestHarness`) — the conformance suite adapters are tested against, now a documented public API instead of an internal test helper.
  - New `docs/guides/reactivity-adapter-guide.md` and a generated `docs/reactivity-capability-matrix.md` (`npm run docs:reactivity-matrix`).

- 0e9a293: Add `serverValidate(schema, payload)` to `@modyra/zod` (sync) and
  `@modyra/standard-schema` (async) — full-schema server-side validation
  returning the same `MdyFormError[]` shape a `form.submit()` action does,
  so one schema and one error shape feed both client and server rejection.
  See the new "one schema, two sides" guide
  (`docs/guides/server-validation.md`) for Next.js/Express/Hono examples.

  Introduce `@modyra/solid`, a Solid binding for the form engine
  (`solidReactivity`, `createSolidForm`, `useSolidForm`) running on Solid's
  native signals, plus the headless widgets bridge (`useMdyField`,
  `useMdySelect`, `executeSolidCommands`) and an `examples/solid/` demo.
  The headless-recipes doc section is tracked as follow-up work.

  Introduce `@modyra/preact`, a thin variant of `@modyra/react` on
  `preact/hooks` + `preact/compat`'s `useSyncExternalStore`. Includes the
  widgets bridge, the React adapter's headless-recipes suite ported
  verbatim (same test file, same assertions — the recipes only touch the
  framework-agnostic field handle), and an `examples/preact/` demo.

  Framework examples for both new adapters are wired into
  `build:examples`/`demo:solid`/`demo:preact` and ship the same signup demo
  (schema validators, cross-field password check, draft persistence,
  undo/redo, cancellable server-side username check) already shown in
  `examples/react` and `examples/vue`.

  `docs/guides/headless-recipes.md` gains a Preact note (the recipes work
  unchanged) and a full Solid section (handles read as accessors directly
  in JSX, no subscription hook) — both verbatim-tested in their adapters'
  `headless-recipes.test.mjs`.

  Introduce `@modyra/svelte`, running the engine on `vanillaReactivity()`
  plus a `toStore()` helper that adapts any Modyra signal into a real
  Svelte `Readable` (`get()`/`$store` syntax both work, verified against
  `svelte/store` directly). Deliberately stores-based, not runes-based:
  Svelte 5's runes are compiler macros unusable in a plain `tsc`-built
  package, while `svelte/store` is ordinary JavaScript — this keeps
  `@modyra/svelte` buildable and testable the same way as every other
  adapter (`tsc` + `node --test`, no new toolchain). A runes-based
  ergonomic layer is a separate, larger follow-up decision (see the
  package README). Includes the headless widgets bridge (`useMdyField`,
  `useMdySelect`, `executeSvelteCommands`) exposing state/view as
  `Readable` stores. No `examples/svelte` yet (needs a Svelte-aware
  bundler for a real `.svelte` file, a separate decision).

### Patch Changes

- Updated dependencies [318e721]
- Updated dependencies [1bb844f]
  - @modyra/core@0.4.0
  - @modyra/widgets@0.4.0
