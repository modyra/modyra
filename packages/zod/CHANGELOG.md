# @modyra/zod

## 0.5.0

### Patch Changes

- Updated dependencies [29621a7]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [a8606da]
- Updated dependencies [f5ee72d]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [1523836]
- Updated dependencies [fc6327f]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [df563d4]
- Updated dependencies [1644bf5]
- Updated dependencies [ec3d8ca]
  - @modyra/core@0.5.0

## 0.4.0

### Minor Changes

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

## 0.3.0

### Patch Changes

- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).

### Patch Changes

- Updated dependencies [fd1e9d8]
  - @modyra/core@0.2.0
