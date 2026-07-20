# Changelog

All notable changes to `@modyra/angular` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com) and the project uses
semantic versioning.

## [Unreleased]

- Typed field arrays: `array()` for repeatable rows (`push`/`insert`/
  `remove`/`move`/`setAll`), with `@modyra/angular/adapter` and
  `@modyra/zod` (`z.array()`) support.
- Release engineering: Changesets-based versioning and publish workflow.

## [0.1.0]

Initial release.

- Framework-agnostic form engine (`@modyra/core`): typed schema (`field`/
  `group`), sync/async/cross-field validation, dirty/touched tracking,
  drafts (autosave/restore), undo/redo, change tracking — all against a
  minimal reactive contract with a built-in vanilla implementation for
  Node/CLI/tests.
- Native bindings for four frameworks: `@modyra/angular` (full renderer
  catalog, devtools, Reactive Forms interop), `@modyra/react`,
  `@modyra/vue`, `@modyra/lit`.
- `@modyra/widgets`: shared headless, accessible widget controllers
  (select, boolean fields, option fields) consumed by every framework
  binding.
- `@modyra/styles`: shared theme tokens and CSS.
- `@modyra/zod`: schema-first typed forms from a `z.object()` — types,
  validators, `required`, and object-level `refine`/`superRefine` as
  cross-field errors, all derived from the Zod schema.
- Cancellable, cross-field async server validation: `serverValidator()`,
  `ctx.signal` (`AbortSignal`), `dependsOn`, `timeoutMs`, `when`.
