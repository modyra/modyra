# Start here

Modyra keeps a form's behaviour — state, validation, drafts, history, submission — in a
framework-independent core, and lets that form travel as data. This index is organised by what you
are trying to do.

**In a hurry?** [The feature tour](feature-tour.md) shows everything Modyra does, with a runnable
example and a screenshot for each.

## Pick your path

**I want a typed form in my application.** Read the [mental model](guides/mental-model.md), then
[typed forms](guides/typed-forms.md), then the [example for your
framework](examples/checkout-scenario.md).

**I want my backend to define the form.** Read [forms as data](guides/ai-generated-forms.md) for the
Dynamic Form Contract and how to parse it safely, then [server validation](guides/server-validation.md).
The [Rust](https://github.com/modyra/modyra/tree/main/sdk/rust) and
[Java](https://github.com/modyra/modyra/tree/main/sdk/java) SDKs produce the same contract.

**I want to build forms visually and export code.** Start with [Studio](studio/overview.md) and
[code generation](studio/target-generation.md).

**I am evaluating the risk of adopting this.** Read [project background](project-background.md),
the [compatibility policy](contract-compatibility.md), the [known issues](known-issues.md) and the
[comparison with other form libraries](guides/comparison-form-libraries.md).

## Core concepts

- [Mental model](guides/mental-model.md) — form state, field handles, and the lifecycle of a field
- [Typed forms](guides/typed-forms.md) — schemas, validation, arrays, keyed collections, drafts, history
- [Usage modes](guides/usage-modes.md) — typed, contract-driven and headless
- [Schema adapters](guides/schemas.md) — Zod and Standard Schema
- [Security](guides/security.md) — trust boundaries, persistence and sanitization
- [What has been attacked](guides/hostile-input.md) — the adversarial measurements, with the commands that produce them
- [Troubleshooting](guides/troubleshooting.md) — pending state, submission and integration problems

## The form engine

- [Server validation](guides/server-validation.md)
- [Forms as data](guides/ai-generated-forms.md) — the Dynamic Form Contract
- [Internationalization](guides/i18n.md)
- [DevTools](guides/devtools.md)

## Examples

Every adapter implements [the same checkout form](examples/checkout-scenario.md), so a difference
between two pages is a difference between two adapters and not between two authors.

- [The scenario](examples/checkout-scenario.md) — read this first
- [Plain](examples/plain.md) — the framework-free renderer

Then the seven framework bindings:

- [Angular](examples/angular.md) · [React](examples/react.md) · [Vue](examples/vue.md) ·
  [Lit](examples/lit.md) · [Solid](examples/solid.md) · [Preact](examples/preact.md) ·
  [Svelte](examples/svelte.md)

UI coverage, SSR behaviour and ecosystem integration differ by adapter. The package README and the
[reactivity capability matrix](reactivity-capability-matrix.md) have the details.

## The widget contract

One definition of how a control behaves, shared by every renderer.

- [UI toolkit](guides/ui-toolkit.md) — the 17 widget kinds, theming and accessibility
- [UI toolkit in Angular](guides/ui-toolkit-angular.md) — Angular's components and template syntax
- [Contract compatibility](contract-compatibility.md) — what a change costs, and which changes break
- [Known issues](known-issues.md) — what does not work yet, and who it affects
- [Reactivity capability matrix](reactivity-capability-matrix.md) — generated, per adapter

## Architecture and integration

- [Multi-framework architecture](guides/multi-framework.md)
- [Writing a reactivity adapter](guides/reactivity-adapter-guide.md)
- [Headless UI recipes](guides/headless-recipes.md) — pairing an adapter with your own components
- [Usage modes in Angular](guides/usage-modes-angular.md) — its three bindings
- [Angular Reactive Forms interop](guides/interop.md)
- [React Native](guides/react-native.md) — what is verified, and what is not

### Decision records

**[Architecture decision records](architecture/README.md)** — why Modyra is built the way it is.
Each one states the pressure that forced the decision, the alternatives that lost, the check that
fails if it is violated, and what it exposes. For a security review, start with
[0007](architecture/0007-expressions-are-data.md),
[0009](architecture/0009-client-validation-is-defence-in-depth.md) and
[0010](architecture/0010-every-claim-has-an-executable-check.md).

## Studio

A local-first visual form builder that edits one project model and compiles it to targets on export.

- [Overview](studio/overview.md) · [Getting started](studio/getting-started.md)
- [Project format](studio/project-format.md) · [A worked project](checkout-example.md)
- [Validation](studio/validators.md)
- [Live canvas](studio/live-canvas.md) · [Drag and drop](studio/drag-and-drop.md)
- [Code generation](studio/target-generation.md)
- [Accessibility](studio/accessibility.md) · [Security](studio/security.md)
- [Plugin authoring](studio/plugin-authoring.md)

## Comparisons and migration

- [Bundle and feature comparison](guides/comparison-form-libraries.md)
- [Angular Reactive Forms](guides/comparison-reactive-forms.md)
- [React Hook Form](guides/comparison-react-hook-form.md)
- [Formik](guides/comparison-formik.md)

Comparisons are dated snapshots. Re-run the scripts they name before quoting the results.

## Project information

- [Project background](project-background.md) — who Modyra is for, what it refuses to do
- [Contributing](../CONTRIBUTING.md) · [Security policy](../SECURITY.md)
- [Roadmap](../ROADMAP.md) · [Changelog](../CHANGELOG.md)
- [Release administration](guides/release-admin-trusted-publishing.md)
- [TypeScript 7 and the primary compiler](guides/typescript-7.md)

Documentation under `docs/` is the source for the published site. Package READMEs stay
self-contained because npm renders them too.
