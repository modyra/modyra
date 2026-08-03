<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/05-social/readme-banner-dark.png">
  <img src="brand/05-social/readme-banner-light.png" alt="Modyra" width="1280">
</picture>

# Modyra

**A typed form engine for TypeScript applications.**

Modyra keeps form state, validation and operations in a framework-independent core. Adapters connect the same form model to Angular, React, Vue, Lit, Solid, Preact and Svelte.

> **Project status:** Modyra is under active development and has not reached 1.0. The core engine and Angular integration currently receive the broadest coverage. The three adapters that render — Angular, Lit and Plain — share the same DOM conformance suite; the five headless ones render nothing and so are checked on semantics rather than markup ([what that means](#what-headless-means-for-conformance)). Adapters also differ in SSR behavior and framework-specific integration depth. Pin versions in production and review release notes before upgrading.

[![CI](https://github.com/modyra/modyra/actions/workflows/ci.yml/badge.svg)](https://github.com/modyra/modyra/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@modyra/core)](https://www.npmjs.com/package/@modyra/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Why Modyra

Form behavior often becomes tied to a rendering framework. Validation, asynchronous work, drafts and change tracking then have to be rewritten when the UI changes or when the same rules are needed on a server, in a worker or in a test.

Modyra separates those concerns:

- `@modyra/core` owns typed state, validation and form operations
- framework adapters connect that state to each framework's reactivity model
- UI packages and headless widgets are optional
- schema adapters support Zod and Standard Schema
- the Dynamic Form Contract represents forms as validated data

## Quick start

```bash
npm install @modyra/core
```

```ts
import { createForm, email, field, group, min, required } from "@modyra/core";

const form = createForm({
  email: field("", [required(), email()]),
  age: field<number | null>(null, [min(18)]),
  address: group({
    city: field("Rome"),
    zip: field(""),
  }),
});

form.f.email.set("person@example.com");
form.f.email.valid(); // true
form.getValue().address.city; // string
```

Validators are factories: use `required()` rather than `required`. Errors are returned as arrays of structured entries. See the [typed forms guide](docs/guides/typed-forms.md) for arrays, asynchronous validation, drafts, history and change tracking.

## Core capabilities

- compile-time checked field handles
- nested groups and typed field arrays
- synchronous, asynchronous, cross-field and form-level validation
- cancellation, dependency tracking, debounce and timeout for asynchronous validators
- draft persistence with field exclusion and expiry
- undo and redo, grouped mutations and minimal change sets
- server error mapping and schema validation
- optional devtools and headless widget controllers

## Packages

| Package | Purpose | Support notes |
| --- | --- | --- |
| [`@modyra/core`](packages/core) | Framework-independent form engine | Primary package, no framework runtime |
| [`@modyra/widgets`](packages/widgets) | Headless interaction and accessibility controllers | Framework-independent |
| [`@modyra/angular`](packages/angular) | Angular signals adapter and UI catalog | Broadest UI integration |
| [`@modyra/react`](packages/react) | React adapter using `useSyncExternalStore` | Headless — renders nothing; no DOM conformance |
| [`@modyra/vue`](packages/vue) | Vue reactivity adapter | Headless — renders nothing; no DOM conformance |
| [`@modyra/lit`](packages/lit) | Lit adapter and custom elements | UI catalog available |
| [`@modyra/plain`](packages/plain) | Framework-free renderer | UI catalog, no framework runtime |
| [`@modyra/solid`](packages/solid) | Solid signals adapter | Headless — renders nothing; no DOM conformance |
| [`@modyra/preact`](packages/preact) | Preact adapter | Headless — renders nothing; no DOM conformance. See SSR note in its README |
| [`@modyra/svelte`](packages/svelte) | Svelte store bridge | Headless — renders nothing; no DOM conformance |
| [`@modyra/zod`](packages/zod) | Zod schema adapter | Optional `zod` peer |
| [`@modyra/standard-schema`](packages/standard-schema) | Standard Schema adapter | Vendor-neutral |
| [`@modyra/styles`](packages/styles) | Shared CSS themes | Optional |

Adapter capabilities and known differences are listed in the generated [reactivity capability matrix](docs/reactivity-capability-matrix.md).

### What "headless" means for conformance

Modyra's widget contract describes a rendered control: its parts, the relations between them, the
classes a theme selects on, and how each part looks in every state. Three suites check an adapter
against it — DOM anatomy, the state matrix, and renderer equivalence — and a fourth, the conformance
CLI, runs them together.

**Those suites apply to the three adapters that render**: `@modyra/angular`, `@modyra/lit` and
`@modyra/plain`. Angular and Lit ship UI catalogs; Plain is the framework-free renderer.

**`@modyra/react`, `@modyra/vue`, `@modyra/solid`, `@modyra/preact` and `@modyra/svelte` render
nothing at all** — they bind the form engine to a framework's reactivity and you bring your own
markup. There is no part for an anatomy check to find and no rendered state for a matrix to compare,
so those three suites do not apply to them. That is the design, not a gap: what they *do* promise —
value, validation, error and lifecycle semantics — is checked by their own suites and by the shared
reactivity capability tests, on every one of the eight packages.

The practical consequence when choosing: with a headless adapter, accessibility and theming are
yours. `@modyra/widgets` exports the same projections, id policy and class vocabulary the rendering
adapters use, so your markup can be built from the contract rather than guessed — but nothing checks
that it was.

## Example: cancellable server validation

```ts
import { createForm, field, serverValidator } from "@modyra/core";

const form = createForm({
  country: field("IT"),
  coupon: field(
    "",
    [],
    serverValidator(
      async (code, ctx) => {
        if (!code) return null;
        const result = await api.checkCoupon(code, ctx.form.fieldValue("country"), {
          signal: ctx.signal,
        });
        return result.valid ? null : "Coupon not valid for this country";
      },
      { dependsOn: ["country"], debounceMs: 400, timeoutMs: 5_000 },
    ),
  ),
});
```

A stale request is aborted when the value or one of its dependencies changes. `form.state.pending()` and `form.state.canSubmit()` include asynchronous validation state.

## Framework examples

The `examples/` directory contains equivalent applications for the supported adapters. Start with the adapter you use:

- [Angular](docs/examples/angular.md)
- [React](docs/examples/react.md)
- [Vue](docs/examples/vue.md)
- [Lit](docs/examples/lit.md)
- [Solid](docs/examples/solid.md)
- [Preact](docs/examples/preact.md)
- [Svelte](docs/examples/svelte.md)

These examples demonstrate API compatibility. They do not imply identical UI, SSR or ecosystem coverage across adapters.

## Documentation

- [Documentation index](docs/README.md)
- [Mental model](docs/guides/mental-model.md)
- [Typed forms](docs/guides/typed-forms.md)
- [Schema adapters](docs/guides/schemas.md)
- [Server validation](docs/guides/server-validation.md)
- [Security](docs/guides/security.md)
- [Studio](docs/studio/overview.md)
- [Troubleshooting](docs/guides/troubleshooting.md)

## Compatibility

- Node 22 or newer for repository development
- TypeScript strict mode
- Angular 21 or newer
- React 18 or newer
- Vue reactivity 3.4 or newer
- Lit 3 or newer
- Solid 1.8 or newer
- Preact 10.19 or newer
- Svelte 4 or newer
- Zod 3.25 or newer when using `@modyra/zod`

Only install the adapter for the framework in your application. Framework packages are optional peers of their respective adapters.

## Build a renderer, and prove the contract is implementable

The widget contract claims a renderer can be built from the published specification alone. Every
renderer in this repository was written by people who also wrote the contract, so none of them tests
that claim — the specification could be incomplete in exactly the places its authors already know.

If you build one, the suite that judges it is published:

```bash
npx modyra-conformance path/to/your.config.mjs
```

The config says which widget kinds you render and how to mount one; `packages/plain/conformance.config.mjs`
is the reference to copy. The suite checks anatomy, ARIA relations, states and keyboard behaviour
against [the contract](docs/guides/ui-toolkit.md) — the same checks `@modyra/plain` and `@modyra/lit`
pass today.

**What counts:** a renderer for any framework, or none, that passes without changes to the contract
or to the suite. **What we want to hear about even more:** where the specification was ambiguous,
underspecified, or wrong. A question you had to answer by reading this repository's source is a
defect in the contract, and worth an issue whether or not you finish the renderer.

## Security notes

Draft persistence uses `localStorage` by default. It is origin-wide, stored as plain text and may survive logout. Exclude passwords, tokens, payment data and other sensitive fields, or provide a custom storage implementation. See the [security guide](docs/guides/security.md).

Client-side validation is defense in depth. Validate submitted data again on the server.

## Development

```bash
pnpm install
npm run build:packages
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository conventions and release checks.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
