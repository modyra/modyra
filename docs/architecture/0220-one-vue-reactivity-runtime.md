# ADR 0220: The Vue adapter runs on the reactivity Vue itself runs on

Status: Accepted

## Context

Vue's reactivity tracks dependencies through module-level state: the effect currently running, and
whether tracking is on. A ref created by one copy of `@vue/reactivity` is invisible to an effect
running in another copy. Reading it records nothing, writing it wakes nobody, and nothing throws.

`@modyra/vue` imported its signal, computed and effect primitives from `@vue/reactivity` and
declared that package as a peer next to `vue`, which bundles its own copy. Whenever the two copies
resolved to different versions (in this workspace 3.5.39 for the adapter and 3.5.40 inside `vue`),
the adapter's state was not reactive for anything the consumer wrote with Vue. A `computed` or
`watchEffect` imported from `vue` read a field once and never again. The adapter's own tests passed
because they observed through the adapter's copy. Its widgets imported from `vue`, so the two runtimes
also met inside the package.

`vue` is a required peer, so a consumer never had a working install without it.

## Decision

`@modyra/vue` imports every reactive primitive from `vue` and declares no dependency or peer on
`@vue/reactivity`. Its state lives in the same runtime as the consumer's components, `computed`,
`watch` and `watchEffect`, by construction rather than by deduplication.

`untracked` cannot use `pauseTracking`, which `vue` does not export. It runs the read inside a
throwaway `ReactiveEffect`. That effect is the active subscriber while the read runs and is stopped
at once, so the read's dependencies attach to nothing. It is created inside a detached effect scope,
so the scope that happens to be active does not hold it.

## Consequences

- One runtime in every install layout. A strict or auto-installing package manager cannot reintroduce
  the split, because there is no second package name to resolve.
- The adapter cannot be used on bare `@vue/reactivity` without `vue`. That was never a working
  configuration, because `vue` was already a required peer.
- `untracked` allocates an effect and a scope per call where `pauseTracking` allocated nothing. The
  cost is linear in the number of untracked reads and is collected immediately.
- `untracked` depends on public `ReactiveEffect` and `EffectScope` behaviour: an effect becomes the
  active subscriber while it runs, and a detached scope is not held by its parent. A Vue release that
  changes either is caught by the tests below.

## Alternatives rejected

- **Pin the adapter's `@vue/reactivity` to vue's version in the lockfile.** This fixes the workspace
  only. Consumers resolve the peer themselves and can still get two copies.
- **Keep the peer and tie its range to vue's exact version.** The range would have to be re-cut on
  every Vue patch, and two package names would still exist to resolve apart.
- **Keep `pauseTracking` from `@vue/reactivity` for `untracked` alone.** It pauses tracking in that
  copy only, so a read in vue's copy would still be tracked.

Decided by applying *the smallest public surface wins*. Option A removes a peer; the others keep it.
TypeSafe was consulted and chose this option at 92% confidence.

## Verification

- `packages/vue/test/a-vue-effect-sees-the-form.test.mjs`: a `computed` and a `watchEffect` from `vue`
  follow a field write (red before this decision); 100 `untracked` reads inside a scope leave
  `scope.effects` empty (red with the detached scope removed: 100 effects held).
- The core reactivity contract run by `packages/vue/test/reactivity.test.mjs`: *untracked read does not
  create a dependency* (red with `untracked` reduced to `fn()`).
- A reintroduced `@vue/reactivity` import fails to build, because the package no longer declares it.

## Security and privacy

None. No trust boundary or data path changes. This removes one declared dependency.
