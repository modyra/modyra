# Changelog

All notable changes to the Modyra packages are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Starlight documentation site with GitHub Pages deployment and Modyra branding.
- Solid, Preact, and Svelte adapters, widgets integrations, examples, and documentation.
- StackBlitz starters for React, Vue, and Lit.
- Server-side `serverValidate()` support for Zod and Standard Schema.

### Fixed

- Documentation-site relative links and edit-page URLs.
- React and Preact examples now react correctly to form-level `canSubmit`, undo, and redo state.

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

[Unreleased]: https://github.com/modyra/modyra/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/modyra/modyra/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/modyra/modyra/releases/tag/v0.2.0
