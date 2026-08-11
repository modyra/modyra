# @modyra/standard-schema

## 0.5.4

### Patch Changes

- Updated dependencies [2e29f30]
- Updated dependencies [2e29f30]
- Updated dependencies [c47d0ac]
- Updated dependencies [6921584]
- Updated dependencies [6581883]
- Updated dependencies [2e29f30]
- Updated dependencies [cf498d8]
- Updated dependencies [985685b]
- Updated dependencies [b048e2c]
- Updated dependencies [d5c1774]
- Updated dependencies [94474e4]
- Updated dependencies [039b0b9]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
  - @modyra/core@2.1.1

## 0.5.3

### Patch Changes

- 8b88c9f: `record()` — a third structural node, for a collection whose keys are data.

  `group()` keys rows at compile time and `array()` keys them by position. `record()` keys them by a
  value the domain owns, so a row survives sorting and filtering, carries the id the server gave it,
  and — the case an array cannot serve — lets **the controls of one row be mounted apart**, as a table
  rendering column by column does.

  ```ts
  const schema = { rows: record(group({ name: field(""), qty: field(0) })) };

  form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });
  form.f.rows.cell("a3f9", "name").set("Ristretto"); // one control of one row
  form.value().rows; // { a3f9: { name: "Ristretto", qty: 2 } }
  ```

  A row exists because `upsert` declared it, never because a control mounted: a control on an
  undeclared key waits and renders empty, unmounting one keeps the value, and validity belongs to the
  declared row — so sorting or filtering a table cannot turn an invalid row valid. `remove(key)` is the
  only way a row's value goes away. ADR 0026 records why.

  Also fixed, found while building this: `MdyFormEngine.getValue()` did not depend on _which_ fields
  exist, so a form value read while a collection was empty stayed empty after rows arrived.

  **Breaking only for implementers.** `MdySchemaPaths` gained a required `recordPaths`. Reading the
  result of `collectSchemaPaths` is unaffected; declaring the interface yourself means adding the member
  (`recordPaths: new Set()` preserves today's behaviour). `walkSchema`, `flattenPatch` and
  `numericKeysToArrays` take new optional parameters and are unchanged when omitted. Nothing a consumer
  of `createForm`, `record()` or a handle calls has changed, which is why this is a minor rather than
  the major the type-surface audit reads it as.

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0

## 0.5.2

### Patch Changes

- Updated dependencies [2037ba5]
- Updated dependencies [3161bad]
  - @modyra/core@2.0.0

## 0.5.1

### Patch Changes

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- Updated dependencies [0a23bfd]
- Updated dependencies [e8b586a]
- Updated dependencies [76f4e7e]
- Updated dependencies [27c1222]
- Updated dependencies [7bafd3d]
- Updated dependencies [3bb85a6]
- Updated dependencies [186cbad]
- Updated dependencies [3068258]
- Updated dependencies [0d3fa5f]
- Updated dependencies [08cb845]
- Updated dependencies [8e67cfe]
- Updated dependencies [75d2553]
- Updated dependencies
- Updated dependencies [342f396]
- Updated dependencies [1a99bbb]
  - @modyra/core@1.0.0

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

### Minor Changes

- e66be95: New package: `@modyra/standard-schema` — one adapter for every Standard Schema v1 library (Zod ≥3.24, Valibot, ArkType, …), zero peer dependencies. You declare the field tree with `field()`/`group()`/`array()`, the schema validates the whole form value with issues attributed to their dotted field paths (`address.city`, `items.0.name`), and schema defaults seed field initials when `validate({})` succeeds. Async schemas are rejected with a clear error (form-level validation is synchronous). Ships with `MdyStandardSchemaTree` for opt-in compile-time agreement between schema and declared fields, and a test suite that asserts identical results across Zod and Valibot.

### Patch Changes

- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0
