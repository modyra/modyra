<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/05-social/readme-banner-dark.png">
  <img src="brand/05-social/readme-banner-light.png" alt="Modyra" width="1280">
</picture>

# Modyra

**Define a form once. Run it in every application that needs it.**

Modyra keeps form state, validation and operations in a framework-independent core, and describes a
form as portable data. Write that form in TypeScript, produce it from a Rust or Java service, or
build it visually in Studio — then render it with Angular, React, Vue, Lit, Solid, Preact, Svelte,
or with no framework at all.

[![CI](https://github.com/modyra/modyra/actions/workflows/ci.yml/badge.svg)](https://github.com/modyra/modyra/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@modyra/core)](https://www.npmjs.com/package/@modyra/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## The problem

The same business form gets rebuilt in every application that shows it. The Angular portal has one
version, the React admin has another, the Java service validates it a third way, and the internal
builder holds a fourth. Four copies of one process, drifting apart, each with its own bugs.

Modyra's answer is to separate what a form *is* from how it is *drawn*:

- `@modyra/core` owns typed state, validation, drafts, history and submission — no framework
  runtime, no dependencies;
- the **Dynamic Form Contract** expresses a form as validated, serializable data that can cross a
  network, a language boundary or a build;
- adapters connect the same form model to each framework's own reactivity;
- `@modyra/widgets` describes how a rendered control behaves and what it exposes to assistive
  technology, so that behaviour is written once rather than per framework.

## Two ways to adopt it

Most teams use one. Nothing stops you using both in the same application.

### Write the form in code

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
form.f.email.valid();          // true
form.getValue().address.city;  // string — the type survives the nesting
```

Field handles are checked at compile time, including through groups and arrays. Validators are
factories: write `required()`, not `required`. Errors come back as arrays of structured entries.

Add the adapter for your framework and the same form drives your components. See the [typed forms
guide](docs/guides/typed-forms.md) for arrays, async validation, drafts, history and change tracking.

### Serve the form as data

A service or a visual editor produces the contract; the frontend receives it as untrusted input,
validates it strictly, and builds the form from it.

```ts
import { parseDynamicForm } from "@modyra/core";

const result = parseDynamicForm(await response.json(), { mode: "strict" });
if (!result.ok) {
  // every finding carries a code, a severity and the path that produced it
  return report(result.diagnostics);
}
```

Strict mode returns no form at all when anything is wrong — a partially valid document is never
accepted. Lenient mode keeps what parsed and reports the rest, which is what an editor preview
wants.

**Three packages build a form from a contract today:** `@modyra/angular` and `@modyra/plain` render
one directly, and `@modyra/react` builds the form state for markup you supply. The contract can be
produced from TypeScript, from [Rust](sdk/rust), from [Java](sdk/java), or by
[Studio](docs/studio/overview.md).

Prefer to own the source? Studio also generates ordinary framework code — `createForm`, `mdyForm`
and `useMdyForm` modules you keep and edit — so the contract runtime is a choice, not a lock.

## What you get

- compile-time checked field handles over nested groups and typed arrays;
- collections keyed by position or by data, so rows survive sorting and re-rendering;
- synchronous, asynchronous, cross-field and form-level validation;
- cancellation, dependency tracking, debounce and timeout for async validators;
- draft persistence with field exclusion and expiry;
- undo and redo, grouped mutations, and minimal change sets;
- server error mapping, and schema validation through Zod or Standard Schema;
- 17 widget kinds with one shared definition of anatomy, states and keyboard behaviour;
- optional devtools and shared CSS themes.

The published form engine measures **26.7 KB gzipped** for a realistic typed form with arrays,
validation, drafts and undo. Reproduce it with `npm run test:core-bundle`.

## Example: server validation that cancels itself

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

A request in flight is aborted when the value or one of its dependencies changes, so a stale
response cannot overwrite a newer one. `form.state.pending()` and `form.state.canSubmit()` account
for async validation.

## Packages

| Package | Purpose | Renders? |
| --- | --- | --- |
| [`@modyra/core`](packages/core) | The form engine and the Dynamic Form Contract. No dependencies | — |
| [`@modyra/widgets`](packages/widgets) | Interaction and accessibility behaviour for the 17 widget kinds | — |
| [`@modyra/angular`](packages/angular) | Angular signals adapter and UI catalog | Yes |
| [`@modyra/lit`](packages/lit) | Lit adapter and custom elements | Yes |
| [`@modyra/plain`](packages/plain) | Framework-free renderer | Yes |
| [`@modyra/react`](packages/react) | React adapter using `useSyncExternalStore` | No — bring your own markup |
| [`@modyra/vue`](packages/vue) | Vue reactivity adapter | No |
| [`@modyra/solid`](packages/solid) | Solid signals adapter | No |
| [`@modyra/preact`](packages/preact) | Preact adapter | No |
| [`@modyra/svelte`](packages/svelte) | Svelte store bridge | No |
| [`@modyra/zod`](packages/zod) | Zod schema adapter | — |
| [`@modyra/standard-schema`](packages/standard-schema) | Standard Schema adapter | — |
| [`@modyra/styles`](packages/styles) | Shared CSS themes | — |

Install only the adapter for your framework. Framework packages are optional peers of their
adapters. Per-adapter differences are listed in the generated [reactivity capability
matrix](docs/reactivity-capability-matrix.md).

### What "headless" means for conformance

`@modyra/widgets` defines a rendered control: its parts, how they relate, the classes a theme
selects on, and how each part looks and behaves in every state. Three suites check a renderer
against it — DOM anatomy, the state matrix, and renderer equivalence — and the conformance CLI runs
them together.

**Those suites apply to the three renderers**: Angular, Lit and Plain.

**The other five adapters render nothing.** They bind the form engine to a framework's reactivity
and you supply the markup, so there is no part for an anatomy check to find. That is the design, not
a gap: what they do promise — value, validation, error and lifecycle semantics — is checked by their
own suites and by the shared reactivity tests, on all eight adapters.

What it means when choosing: with a headless adapter, accessibility and theming are yours.
`@modyra/widgets` exports the same projections, id policy and class vocabulary the renderers use, so
your markup can be built from the definition rather than guessed — but nothing checks that it was.

## Examples

`examples/` holds the same checkout form implemented for every adapter, so a difference between two
of them is a difference between two adapters and not between two authors.

[The scenario](docs/examples/checkout-scenario.md) ·
[Plain](docs/examples/plain.md) ·
[Angular](docs/examples/angular.md) ·
[React](docs/examples/react.md) ·
[Vue](docs/examples/vue.md) ·
[Lit](docs/examples/lit.md) ·
[Solid](docs/examples/solid.md) ·
[Preact](docs/examples/preact.md) ·
[Svelte](docs/examples/svelte.md)

They demonstrate API compatibility. They do not imply identical UI, SSR behaviour or ecosystem
coverage across adapters.

## Documentation

- [Start here](docs/README.md) — the full index
- [Mental model](docs/guides/mental-model.md) — how the engine thinks
- [Typed forms](docs/guides/typed-forms.md) — arrays, async validation, drafts, history
- [Forms as data](docs/guides/ai-generated-forms.md) — the Dynamic Form Contract, and how to trust it
- [Schema adapters](docs/guides/schemas.md) · [Server validation](docs/guides/server-validation.md)
- [Security](docs/guides/security.md) · [Troubleshooting](docs/guides/troubleshooting.md)
- [Studio](docs/studio/overview.md) — build a form visually, export the contract or the code

## Project status

`@modyra/core` and `@modyra/widgets` are at **2.4.0** and versioned under a published
[compatibility policy](docs/contract-compatibility.md): nothing is removed or changed in a breaking
way outside a major release.

**Every adapter, both SDKs and Studio version independently and are still below 1.0.** Their public
surfaces can change in a minor release. Pin versions and read the release notes before upgrading.
Coverage is uneven by design — see the table above and the [known
issues](docs/known-issues.md), which are published rather than kept private.

## Compatibility

Node 22+ for repository development · TypeScript strict mode · Angular 21+ · React 18+ · Vue
reactivity 3.4+ · Lit 3+ · Solid 1.8+ · Preact 10.19+ · Svelte 4+ · Zod 3.25+ with `@modyra/zod`.

## Build a renderer, and test the definition

The widget contract claims a renderer can be built from the published specification alone. Every
renderer here was written by people who also wrote that specification, so none of them tests the
claim — it could be incomplete in exactly the places its authors already know.

The suite that judges one is published:

```bash
npx modyra-conformance path/to/your.config.mjs
```

The config declares which widget kinds you render and how to mount one;
`packages/plain/conformance.config.mjs` is the reference to copy. It checks anatomy, ARIA relations,
states and keyboard behaviour against [the contract](docs/guides/ui-toolkit.md) — the same checks
Plain and Lit pass today.

More useful than a finished renderer: where the specification was ambiguous, underspecified or
wrong. A question you had to answer by reading this repository's source is a defect in the
specification, and worth an issue whether or not you finish.

## Security

Draft persistence uses `localStorage` by default: origin-wide, plain text, and it may survive
logout. Exclude passwords, tokens and payment data, or supply your own storage. Client-side
validation is defence in depth — validate submitted data again on the server. See the [security
guide](docs/guides/security.md).

## Development

```bash
pnpm install
npm run build:packages
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and release checks.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
