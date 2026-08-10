# Project background

Why Modyra exists, what it refuses to do, and the standard a change is held to. Read this before
proposing a design; it explains the reasoning that most review comments come back to.

## The problem

Form behaviour normally ends up tied to the rendering framework. Validation, asynchronous work,
drafts and change tracking are written against the framework's form library, so they have to be
rewritten when the UI changes — or duplicated when the same rules are needed on a server, in a
worker, or in a test.

Modyra is a typed form engine for TypeScript applications. `@modyra/core` owns form state,
validation and operations independently of any rendering framework; adapters connect that same form
model to Angular, React, Vue, Lit, Solid, Preact and Svelte.

Success is expressing the full behaviour of a demanding form **once**, with compile-time checked
field handles, and having it survive a change of framework, runtime or rendering surface.

## Who it is for

TypeScript developers building complex forms who have hit the ceiling of their framework's native
form library — asynchronous and cross-field validation, cancellation, drafts, undo/redo, minimal
change sets, server error mapping.

All adapters are equal citizens. **No framework is the intended default**, even where integration
depth currently differs; where it does differ, the difference is published in the [reactivity
capability matrix](reactivity-capability-matrix.md) rather than left implicit.

Two audiences follow from the same job rather than replacing it: developers who need the same
validation rules to run outside the browser, and developers who build a form visually in
[Studio](studio/overview.md) and export real code into their application.

## What makes it different

A framework-independent typed core with a genuine multi-adapter contract around it — not a form
library with bindings bolted on:

- compile-time checked typed field handles over nested groups and typed field arrays;
- one conformance suite the adapters share, with differences published rather than hidden;
- the [Dynamic Form Contract](guides/ai-generated-forms.md), which represents forms as validated
  data, so a form can be transported, generated, or authored visually and still be the same form;
- [`@modyra/widgets`](guides/ui-toolkit.md) as a framework-agnostic headless interaction and
  accessibility layer, so UI behaviour is not re-implemented per framework.

## Principles

These decide arguments. When two of them pull in different directions, the earlier one wins.

1. **The core owns behaviour; frameworks only render it.** Anything that could live in
   `@modyra/core` or `@modyra/widgets` does not belong in an adapter.
2. **One contract, many consumers.** `@modyra/widgets` is the complete framework-agnostic UI
   contract. Renderers consume it rather than redefine it; any intentional divergence must be
   explicit, justified and contract-tested.
3. **State limits beside features.** Version status, adapter coverage differences and security
   caveats are published next to the capability they qualify. Never claim production readiness
   uniformly across adapters; keep comparisons factual and dated.
4. **Types are the primary interface.** Compile-time checking of field handles, paths and values is
   the main safety guarantee, not a convenience.
5. **Evidence over assertion.** A claim ships with the test, audit or generated document that
   demonstrates it — which is why [contract gaps](contract-gaps.md) is a published document rather
   than a private list.

## Limits, stated on purpose

Principle 3 applies to this page too.

- **Two packages carry a stable promise; the rest do not.** `@modyra/core` and `@modyra/widgets`
  are published at 2.0.0 and versioned under the compatibility policy. Every adapter, the SDKs and
  Studio version independently and are still below 1.0, so their public surfaces can change in a
  minor release. Pin versions and read the release notes before upgrading.
- **Coverage is uneven, deliberately.** Three adapters render and are held to the DOM conformance
  suite; five are headless and are checked on semantics instead. UI coverage, SSR behaviour and
  integration depth differ by adapter.
- **`@modyra/core` carries no framework runtime.** Framework packages stay optional peers.
- **Draft persistence defaults to `localStorage`** — origin-wide, plain text, and it may survive
  logout. Sensitive fields must be excluded or a custom storage supplied. See
  [Security](guides/security.md).
- **Client-side validation is defence in depth.** Submitted data must be validated again on the
  server.
- Compatibility floors: Node 22+, Angular 21+, React 18+, Vue reactivity 3.4+, Lit 3+, Solid 1.8+,
  Preact 10.19+, Svelte 4+, Zod 3.25+.

Still undecided, and tracked in [the roadmap](../ROADMAP.md): the deprecation policy for the
packages that are not yet 1.0; the final error, diagnostic and server-validation result shapes; the
Studio project format and its migration policy; React Native integration.

There are no customers, testimonials, case studies, adoption numbers, pricing or hosted service, and
no benchmark result that is not reproducible from a script in this repository. Anything claiming
otherwise is wrong.

## How the work is done

Verification is layered, and a change is expected to run the narrowest relevant layer first:
per-package unit tests, then contract and conformance audits (`test:contracts`,
`test:widget-contract`, `test:themes`), then Playwright end-to-end, then bundle and performance
budgets.

Accessibility is not a later pass: WCAG 2.2 AA is the floor for every surface, plus full keyboard
parity — any pointer-only interaction must have a keyboard-only equivalent.

[Contributing](../CONTRIBUTING.md) describes the mechanics: how to run things, what a reviewable
change looks like, and what is required before a change is accepted.
