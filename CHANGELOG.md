# Changelog

Modyra's packages version independently, and their release notes are generated from changesets at
release time. **The per-package changelog is the authoritative record** of what changed in a package
and why:

| Package | Notes |
| --- | --- |
| `@modyra/core` | [changelog](packages/core/CHANGELOG.md) |
| `@modyra/widgets` | [changelog](packages/widgets/CHANGELOG.md) |
| `@modyra/angular` | [changelog](packages/angular/CHANGELOG.md) |
| `@modyra/lit` | [changelog](packages/lit/CHANGELOG.md) |
| `@modyra/plain` | [changelog](packages/plain/CHANGELOG.md) |
| `@modyra/react` | [changelog](packages/react/CHANGELOG.md) |
| `@modyra/vue` | [changelog](packages/vue/CHANGELOG.md) |
| `@modyra/solid` | [changelog](packages/solid/CHANGELOG.md) |
| `@modyra/preact` | [changelog](packages/preact/CHANGELOG.md) |
| `@modyra/svelte` | [changelog](packages/svelte/CHANGELOG.md) |
| `@modyra/zod` | [changelog](packages/zod/CHANGELOG.md) |
| `@modyra/standard-schema` | [changelog](packages/standard-schema/CHANGELOG.md) |
| `@modyra/styles` | [changelog](packages/styles/CHANGELOG.md) |
| `@modyra/eslint-plugin` | [changelog](packages/eslint-plugin/CHANGELOG.md) |

Studio's packages carry their own changelogs under `packages/studio-*`.

This file used to restate those notes by hand, and drifted twice. It now records only the release
tags, which are facts, and points at the generated notes for detail.

## Release tags

| Tag | Date | What it carried |
| --- | --- | --- |
| [`v2.0.0`](https://github.com/modyra/modyra/releases/tag/v2.0.0) | 2026-08-09 | `@modyra/core` and `@modyra/widgets` to 2.0.0. Two breaking changes, both in the type surface: a new `"sanitizer-error"` member on `MdySecurityViolationKind`, and the withdrawal of eight keyboard bindings that gave dialog overlays combobox opening keys ([ADR 0021](docs/architecture/0021-a-dialog-overlay-is-not-a-combobox.md)). No renderer had implemented the withdrawn keys. |
| [`v0.5.0`](https://github.com/modyra/modyra/releases/tag/v0.5.0) | 2026-08-01 | Svelte example, completing the runnable set; tested react-hook-form and Formik migration guides; StackBlitz starters for Solid and Preact; Hermes compilation verified for React Native. |
| [`v0.4.0`](https://github.com/modyra/modyra/releases/tag/v0.4.0) | 2026-07-23 | Starlight documentation site; Solid, Preact and Svelte adapters; server-side `serverValidate()` for Zod and Standard Schema; the reactivity adapter API redesign. |
| [`v0.3.0`](https://github.com/modyra/modyra/releases/tag/v0.3.0) | 2026-07-21 | React, Vue and Lit adapters and examples; the widget contract's first published form. |
| [`v0.2.0`](https://github.com/modyra/modyra/releases/tag/v0.2.0) | 2026-07-20 | First public release of the core engine and the Angular adapter. |

Versions currently on npm are listed in the [package table](README.md#packages).
