# @modyra/core

## 0.4.0

### Minor Changes

- 318e721: Add Dynamic Form Contract v2 with data-only layout sections/columns,
  declarative visibility/enabled rules, structured strict/lenient parser
  diagnostics, a machine-readable JSON Schema, shared conformance fixtures,
  and the initial `modyra-contract` Rust crate. Contract v1 and the legacy
  `parseDynamicFields()` API remain supported.

  Add a runnable Rust `reqwest` POST example that sends a Contract v2 form
  submission and prints both raw and typed API responses, including normalized
  422 validation errors and optional bearer-token authentication.

  Add an Axum form API example and connect the existing Angular dynamic-form
  demo to it: Rust maps checkout business configuration to Contract v2 JSON,
  Angular validates and renders it, and completed values are posted back to
  Rust with success or normalized server-error output.

  Extend Contract v2 with recursive `group` and `array` schema nodes. The
  strict parser validates structural limits and flattens accepted nodes to the
  dotted/indexed paths consumed by the Angular dynamic renderer. Rust now emits
  the original checkout shape (`shipping` group and `items` array) and omits
  absent option fields from JSON instead of serializing them as `null`.

- 1bb844f: Reactivity/adapter API redesign (`piano-modyra-reactivity-adapter-api.md`), all additive:

  - `MdyReactivity` gains optional `id`/`kind`/`capabilities` (honest, per-adapter, never claiming an unimplemented guarantee), `createScope()`/`MdyReactiveScope` (ownership with idempotent, cascading destroy), typed errors (`MdyUnsupportedCapabilityError`, `MdyCrossRuntimeObservationError`, `MdyDestroyedScopeError`, `MdyAdapterContractError`, `MdyActivationError`) and structured diagnostics (`MdyDiagnostics`, `MDY_*` codes). `canEffect` stays as a deprecated alias.
  - `vanillaReactivity()` is the reference implementation: real `batch()`, `flush()` and `observe()` (a selector-based subscription that only fires on an actual change), built on a redesigned shared-drain effect scheduler that settles chained effect triggers within one flush/batch instead of needing one microtask per hop.
  - `MdyFormEngine`/`MdyTypedFormBase` gain `form.mutate(fn)` — coalesces a burst of field writes into exactly one history entry regardless of whether the adapter's effects run synchronously (Vue/Solid) or are scheduler-deferred (vanilla/Angular); delegates to a real runtime `batch()` when the adapter reports it.
  - `MdyFormEngineOptions.autoActivate` (default `true`, unchanged behavior) plus `activate()`/`deactivate()`: pause/resume draft persistence, history recording and async validators without losing any state (field values, undo/redo stacks, draft baseline). `@modyra/react` and `@modyra/preact`'s `useMdyForm` now construct with `autoActivate: false` and call `activate()`/`deactivate()` from their effect instead of destroying on unmount — tolerant of React/Preact Strict Mode's dev-only double-invoke and safe during SSR (activation only ever runs client-side). **Behavior note**: the hook no longer calls `form.destroy()` automatically on unmount; call it yourself if you need a hard, final teardown (releasing field records) rather than a pause.
  - `@modyra/angular`'s adapter hardened: `effect()` without an `Injector` now throws a typed error by default instead of returning a silent no-op (`unsupported: "report"` opts back into graceful, diagnosed degradation); real capabilities; `equal` propagated to Angular's native `signal()`/`computed()`; `onError` now actually respected (previously silently ignored).
  - Fixed a real, if latent, bug in `@modyra/react`/`@modyra/preact`: `createStore()` used to build a fresh `vanillaReactivity()` to observe a field handle, which happened to work only because vanilla's tracking is module-global — it silently never re-rendered for a handle owned by a different adapter's form. Now resolves the real owner via a new handle-ownership registry (`getFieldHandleOwner()`).
  - Fixed a real pre-existing bug found while building `mutate()`: `undo()`/`redo()` restore a value through the same non-atomic multi-field write path `mutate()` guards against, so a synchronous-effect adapter could see 1-2 spurious extra history entries mid-restore.
  - Fixed a scheduler bug found while auditing error handling: an effect throwing without `onError` used to abort the shared drain loop, silently starving sibling effects scheduled in the same batch.
  - New `@modyra/core/testing` subpath (`runReactivityContractTests`, `MdyReactivityTestHarness`) — the conformance suite adapters are tested against, now a documented public API instead of an internal test helper.
  - New `docs/guides/reactivity-adapter-guide.md` and a generated `docs/reactivity-capability-matrix.md` (`npm run docs:reactivity-matrix`).

## 0.3.0

### Minor Changes

- c7dadfb: Whole-entry slimming (roadmap phase J). The root entry `@modyra/core` now re-exports only the form engine (typed forms, validation, security, dynamic config, reactivity): **10.7 KB min+gzip** measured, down from 17.2 KB (−38%). Satellite utilities are no longer re-exported from the root — they remain in the package via their curated subpath entries: `@modyra/core/datetime`, `/localization`, `/ui` (icons, keyboard, options-utils, overlay-position), `/serialize`, `/devtools`, `/i18n`, `/dynamic-config`. **Migration:** change e.g. `import { formatDate } from "@modyra/core"` to `import { formatDate } from "@modyra/core/datetime"`. The framework adapters (`@modyra/react`, `/vue`, `/lit`) re-export the core surface via `export *`, so the same migration applies to satellite names previously reached through them (e.g. `mountMdyDevtools` now comes from `@modyra/core/devtools`). Also new: compile-time `__MDY_DEV__=false` define strips dev warnings in production builds (esbuild/rollup/vite), and a CI guard (`test:core-bundle`) now budgets the whole entry (11 KB) and the realistic surface (10 KB) so the comparison-doc numbers can't silently regress.
- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).
