# Modyra documentation

Everything about the engine and the adapters, organized by what you are
trying to do. New here? Start with the [main README](../README.md), run a
[framework example](#framework-examples), then read the two core guides
(mental model → typed forms).

This same content is also published as a searchable site — see
[`../site/`](../site/), generated from these files by
`npm run docs:build` (`../scripts/sync-docs-site.mjs`). Edit the markdown
here; the site is a build artifact, never hand-edited.

## Getting started

| Document                             | What it covers                                                        |
| :----------------------------------- | :-------------------------------------------------------------------- |
| [Main README](../README.md)          | Install, 60-second engine, real-world agnostic scenarios, packages    |
| [Framework examples](examples/)      | The same checkout app in Angular, React, Vue and Lit                  |
| [Usage modes](guides/usage-modes.md) | Typed API vs declarative vs headless vs dynamic JSON — pick your mode |

## Core concepts

| Document                                     | What it covers                                                                                                    |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| [Mental model](guides/mental-model.md)       | The state graph, field lifecycle, operation semantics (`set`/`patch`/`reset`)                                     |
| [Typed forms](guides/typed-forms.md)         | Schema, handles, field arrays, async validation, drafts **(security note)**, undo/redo, `mutate()`, construction/activation (SSR, Strict Mode), `getChanges`, wizard, Zod |
| [Schema adapters](guides/schemas.md)         | `@modyra/zod` vs `@modyra/standard-schema` (Valibot, ArkType, …) — which model, which trade-offs                  |
| [Server validation](guides/server-validation.md) | One schema, two sides — `serverValidate()` with Next.js/Express/Hono, tested runnable examples                |
| [Troubleshooting](guides/troubleshooting.md) | Why is `canSubmit()` false? Why is a field stuck in `pending`?                                                    |

## Framework examples

The identical checkout — nested groups, typed array rows, cancellable
server validation, submit with server errors, drafts — in each binding:

- [Angular](examples/angular.md) — `mdyForm` + UI catalog, `@for` over `rows()`
- [React](examples/react.md) — `useMdyForm` / `useMdyField`, headless controlled inputs
- [Vue](examples/vue.md) — `createVueForm` on `@vue/reactivity`
- [Lit](examples/lit.md) — `createLitForm` + `<mdy-*-field>` custom elements

## Adapters and architecture

| Document                                                            | What it covers                                                                                                     |
| :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| [Multi-framework architecture](guides/multi-framework.md)           | What's in `@modyra/core`, the four-primitive reactive contract, adapter recipes (React/Vue/Lit/Astro)              |
| [Reactive Forms interop](guides/interop.md)                         | `mdyCva` — embed Modyra controls in existing Angular Reactive Forms                                                |
| [Compared with Reactive Forms](guides/comparison-reactive-forms.md) | Honest trade-offs, migration paths                                                                                 |
| [Form library comparison](guides/comparison-form-libraries.md)      | Measured bundle sizes + feature matrix vs RHF, TanStack Form, Formik, Final Form, VeeValidate — updated 2026-07-21 |
| [Writing a reactivity adapter](guides/reactivity-adapter-guide.md)   | The `MdyReactivity` contract, capability honesty, ownership/scope, the conformance suite — for building the next framework adapter |
| [Reactivity capability matrix](reactivity-capability-matrix.md)      | Generated (not hand-maintained) table of what each adapter's `MdyReactivity` actually declares — `npm run docs:reactivity-matrix` regenerates it |

## UI, theming and tools

| Document                                           | What it covers                                                                                                         |
| :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| [UI toolkit](guides/ui-toolkit.md)                 | Renderer catalog, enterprise select, dynamic forms, CSS tokens                                                         |
| [AI-generated forms](guides/ai-generated-forms.md) | LLM output → `parseDynamicFields()` → render: JSON contract v1/v2 (layout, rules), system prompt template, safe pipeline |
| [Injection prevention](guides/security.md)         | Sanitization profiles at the engine's write choke point, violation telemetry, always-on draft/server structural checks |
| [Headless recipes](guides/headless-recipes.md)     | shadcn/ui, Radix, shadcn-vue/Reka: tested props-mappers from field handles to your component library                   |
| [I18n](guides/i18n.md)                             | UI strings (en/it/de/fr/es), date/time value models, localized parsing                                                 |
| [DevTools](guides/devtools.md)                     | Hotkey overlay, masking, production notes                                                                              |

## Project

| Document                                                                       | What it covers                                                           |
| :----------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| [Security policy](../SECURITY.md)                                              | Threat model, reporting, draft/SSR notes                                 |
| [Contributing](../CONTRIBUTING.md)                                             | Setup, conventions, PR checklist                                         |
| [Trusted Publishing admin runbook](guides/release-admin-trusted-publishing.md) | npm OIDC setup, Changesets integration checks, staged release operations |
| [Rust SDK](../sdk/rust/README.md) | `modyra-contract` crate (Dynamic Form Contract v2, shared fixtures), reqwest/Axum examples — not published to crates.io yet |
| [Changelog](../CHANGELOG.md)                                                   | Release history                                                          |
| [Brand assets](assets/brand/)                                                  | Logo, palette, typography                                                |

## Conventions for new documents

- **Guides** (concept documentation) live in `docs/guides/` — one topic per
  file, named after the topic (`typed-forms.md`, not `guide2.md`).
- **Examples** (runnable walkthroughs) live in `docs/examples/` — one
  framework per file, same scenario across files so adapters compare
  side by side.
- Every guide starts with a one-sentence summary and ends with links to
  related guides. Code samples must match the public API of the current
  release — treat them as compile-checked documentation.
- Package-level docs live next to the code (`packages/<name>/README.md`)
  and are what npm renders; the guides go deep, the READMEs stay
  self-contained.
