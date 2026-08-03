# Documentation

Use this index to find the conceptual guides, integration notes and reference material for Modyra.

## Start here

- [Mental model](guides/mental-model.md): form state, field handles and lifecycle
- [Typed forms](guides/typed-forms.md): schemas, validation, arrays, drafts and history
- [Usage modes](guides/usage-modes.md): typed, declarative, headless and data-driven forms
- [Security](guides/security.md): trust boundaries, persistence and server validation
- [Troubleshooting](guides/troubleshooting.md): pending state, submission and integration issues

## Form engine

- [Schema adapters](guides/schemas.md)
- [Server validation](guides/server-validation.md)
- [Internationalization](guides/i18n.md)
- [DevTools](guides/devtools.md)
- [Dynamic form configuration](guides/ai-generated-forms.md)

## Framework integrations

- [Angular](examples/angular.md)
- [React](examples/react.md)
- [Vue](examples/vue.md)
- [Lit](examples/lit.md)
- [Solid](examples/solid.md)
- [Preact](examples/preact.md)
- [Svelte](examples/svelte.md)

All seven implement [the same checkout scenario](examples/checkout-scenario.md), so a difference
between two pages is a difference between two adapters. UI coverage, SSR behavior and ecosystem
integration differ by adapter; consult the package README and [reactivity capability
matrix](reactivity-capability-matrix.md) for details.

## The widget contract

- [UI toolkit](guides/ui-toolkit.md): the rendered catalogue and what a renderer owes it
- [Contract compatibility](contract-compatibility.md): what a change to the contract costs, and which changes are breaking
- [Contract gaps](contract-gaps.md): the known open defects, each with the evidence behind it

## Architecture and integration

- [Multi-framework architecture](guides/multi-framework.md)
- [Writing a reactivity adapter](guides/reactivity-adapter-guide.md)
- [Headless UI recipes](guides/headless-recipes.md)
- [Angular Reactive Forms interop](guides/interop.md)
- [React Native compatibility notes](guides/react-native.md)
- [Reactivity capability matrix](reactivity-capability-matrix.md)

### Decision records

Why Studio is built the way it is. Each records the alternatives that were rejected and why, so a
change that revisits one starts from the original reasoning rather than from scratch.

- [0001 — Project and contract model](architecture/0001-project-and-contract-model.md)
- [0002 — Ids and paths](architecture/0002-ids-and-paths.md)
- [0003 — Command engine](architecture/0003-command-engine.md)
- [0004 — Target plugin API](architecture/0004-target-plugin-api.md)
- [0005 — Expressions and references](architecture/0005-expressions-and-references.md)

## Studio

- [Overview](studio/overview.md)
- [Getting started](studio/getting-started.md)
- [Project format](studio/project-format.md)
- [Validation](studio/validators.md)
- [Live canvas](studio/live-canvas.md)
- [Drag and drop](studio/drag-and-drop.md)
- [Code generation](studio/target-generation.md)
- [Accessibility](studio/accessibility.md)
- [Security](studio/security.md)
- [Plugin authoring](studio/plugin-authoring.md)

## Comparisons and migration

- [Angular Reactive Forms](guides/comparison-reactive-forms.md)
- [React Hook Form](guides/comparison-react-hook-form.md)
- [Formik](guides/comparison-formik.md)
- [Bundle and feature comparison](guides/comparison-form-libraries.md)

Comparisons are dated snapshots. Re-run their associated scripts and review the methodology before relying on the results.

## Project information

- [Project background](project-background.md) — who Modyra is for, what it refuses to do, and the principles that decide arguments
- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
- [Roadmap](../ROADMAP.md)
- [Changelog](../CHANGELOG.md)
- [Release administration](guides/release-admin-trusted-publishing.md)

Documentation under `docs/` is the source for the published site. Package READMEs remain self-contained because they are also rendered by npm.
