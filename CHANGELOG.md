# Changelog

All notable changes to the Modyra packages are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Svelte example (`examples/svelte`), compiled through `esbuild-svelte` — closes framework breadth to 7/7, all with a working example.
- Tested react-hook-form and Formik migration guides (`docs/guides/comparison-react-hook-form.md`, `comparison-formik.md`) — each side-by-side snippet is proven by a real jsdom + react-dom test, not just described.
- StackBlitz starters for Solid and Preact (React, Vue and Lit shipped in 0.3.0/0.4.0's Unreleased cycle already).
- React Native / Hermes compatibility re-verified with the real compiler (`hermes-compiler`, the exact one React Native 0.86.0 depends on): compiles clean, zero errors — see `docs/guides/react-native.md`.
- Conference/meetup pitch deck, published as a page on the docs site (`site/src/pages/pitch.astro`).

### Fixed

- `scripts/publish-workspace.mjs`'s hardcoded package list predated the Solid/Preact/Svelte adapters, so a clean release bumped their `package.json` without ever publishing them — fixed, all `@modyra/*@0.4.0` now live on npm.

## [0.4.0] - 2026-07-23

### Added

- Starlight documentation site with GitHub Pages deployment and Modyra branding.
- Solid, Preact, and Svelte adapters, widgets integrations, examples, and documentation.
- StackBlitz starters for React, Vue, and Lit.
- Server-side `serverValidate()` support for Zod and Standard Schema.
- Reactivity/adapter API redesign (`@modyra/core`, `@modyra/angular`, `@modyra/react`, `@modyra/preact`): optional `capabilities`/`createScope`/`MdyReactiveScope` on `MdyReactivity`, typed errors, structured diagnostics; real `batch()`/`flush()`/`observe()` on `vanillaReactivity()`; `form.mutate()` for coalesced history entries; `MdyFormEngineOptions.autoActivate` plus `activate()`/`deactivate()` for pausing/resuming draft, history and async validators without losing state; `@modyra/core/testing` (`runReactivityContractTests`) as a public conformance-suite API.
- `@modyra/react`/`@modyra/preact`'s `useMdyForm` now constructs with `autoActivate: false` and activates/deactivates from its effect instead of destroying on unmount — tolerant of React Strict Mode's dev-only double-invoke and safe during SSR.
- Dynamic Form Contract v2 (`@modyra/core`): data-only layout (sections/columns), declarative visibility/enabled rules, structured strict/lenient parser diagnostics, recursive `group`/`array` schema nodes, a shared JSON Schema and conformance fixtures (`spec/`). Contract v1 and `parseDynamicFields()` remain fully supported.
- `modyra-contract` Rust crate (`sdk/rust/`) implementing Contract v2, plus runnable `reqwest`/Axum examples; the Angular dynamic-form demo now round-trips against a real Rust API. Not published to crates.io yet — a separate decision.
- Generated reactivity adapter capability matrix (`npm run docs:reactivity-matrix` → `docs/reactivity-capability-matrix.md`) and a new adapter-authoring guide (`docs/guides/reactivity-adapter-guide.md`).

### Fixed

- Documentation-site relative links and edit-page URLs.
- React and Preact examples now react correctly to form-level `canSubmit`, undo, and redo state.
- `createStore()` in `@modyra/react`/`@modyra/preact` no longer builds an unrelated `vanillaReactivity()` instance to observe a field handle — it resolves the handle's real owning reactivity, fixing a latent cross-runtime observation bug.
- `undo()`/`redo()` no longer push spurious history entries when restoring a value on a synchronous-effect adapter.
- `@modyra/angular`'s reactivity adapter no longer silently returns a no-op effect without an `Injector` (throws a typed error by default) and no longer silently ignores the `onError` effect option.
- Vanilla's effect scheduler no longer lets one effect's uncaught error stop sibling effects scheduled in the same batch from running.

### Changed

- CI's release workflow now triggers only on a pushed version tag (`v*`), not on every push to `main`.
- Bundle size budgets (`scripts/check-bundle.mjs`, `scripts/check-core-bundle.mjs`) raised to reflect the reactivity/adapter API additions above — see `docs/guides/comparison-form-libraries.md` for the measured before/after numbers.

## [0.3.0] - 2026-07-21

### Added

- `@modyra/standard-schema` adapter.
- `oneOf()` and `eachOneOf()` option-whitelisting validators with automatic binding for dynamic fields.
- Injection prevention at the form engine write boundary.
- Tested headless integration recipes for shadcn/ui, Radix UI, and Reka UI.
- AI-generated forms guide.
- Playwright browser smoke tests and a StackBlitz Angular example.
- Cancellable `serverValidator()` usage in framework examples.

### Changed

- Rebalanced the workspace around the framework-agnostic core, positioning Angular as one of the supported first-class bindings.
- Reduced the whole `@modyra/core` entry bundle from approximately 17.2 KB to 10.7 KB gzip by moving optional features to satellite subpath entries.
- Added measured bundle and feature comparisons using esbuild and Rollup.
- Removed the Angular CLI dependency from the workspace root.
- Prepared the packages and release workflow for trusted npm publishing.

### Fixed

- Moved `aria-expanded` state to the correct overlay toggle buttons.
- Stabilized the Angular load-options test through explicit concurrency handling.
- Hardened the staged npm publishing workflow.

## [0.2.0] - 2026-07-20

### Added

- Framework-agnostic `@modyra/core` form engine.
- Angular, React, Vue, and Lit bindings.
- Headless `@modyra/widgets` field and select controllers, accessibility contracts, and command runtime.
- React and Vue widget hooks.
- Framework-agnostic `@modyra/styles` themes.
- Zod integration.
- Per-framework examples with runtime theme switching.
- Complete Lit control catalog with themed fields, selects, multiselects, date pickers, date ranges, time pickers, overlays, and modal variants.
- Reactive framework-agnostic developer tools.
- Typed field arrays through `array()`.
- Cancellable, cross-field asynchronous validation with dependency tracking.
- Changesets-based versioning and automated publishing workflow.
- Bundle-size and performance regression budgets.

### Changed

- Migrated from the original Angular-focused layout to a multi-package monorepo centered on `@modyra/core`.
- Split Angular into thin adapter and UI entry points over the shared core and widgets packages.
- Split Lit into adapter and UI entry points with one catalog file per element.
- Decomposed the engine into field records, asynchronous runners, draft/history managers, typed-form base classes, and schema utilities.
- Improved Lit visual and markup parity with the Angular catalog.
- Made draft autosave serialization single-pass and form-value assembly incremental.
- Expanded documentation, examples, package READMEs, and quick-start guidance.

### Fixed

- Restored minification for `@modyra/styles`.
- Escaped developer-tools HTML output.
- Corrected pnpm workspace wiring and ignored nested pnpm-linked `node_modules` directories.
- Fixed React example JSX runtime configuration.
- Kept controls inert until their `name` or `[field]` inputs resolve.
- Corrected Lit theme markup, state classes, overlay positioning, wrappers, labels, error helpers, and stylesheet resolution.
- Compiled the Zod package as part of `build:lib`.
- Separated performance benchmarks from the blocking Angular test suite.
- Removed unused widget testing stubs.

[Unreleased]: https://github.com/modyra/modyra/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/modyra/modyra/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/modyra/modyra/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/modyra/modyra/releases/tag/v0.2.0
