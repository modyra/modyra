# @modyra/widgets

Headless widget controllers and the universal interaction/accessibility
contract shared by every [Modyra](https://github.com/modyra/modyra)
renderer (Angular components, Lit elements, your own design system).

Zero dependencies, framework-agnostic, DOM-free: controllers operate on
state and emit **commands**; renderers translate commands into DOM changes.

## What is inside

- **Controllers and state machines** for the shared widgets: text-like
  fields, boolean fields (checkbox/toggle), option fields (radio group),
  select (with keyboard navigation, search, overlay state).
- **The universal widget contract** — `MdyWidgetController`,
  `MdyWidgetViewContract`, `MdyPartContract`: intents in, semantic state
  out, ARIA attributes derived from one place.
- **Command runtime** — `processWidgetCommands()`, `createMdyAnnouncer()`
  (live-region announcements), deterministic ID factory
  (`defaultWidgetIdFactory`).
- **Runtime capabilities** — `browserRuntimeCapabilities` /
  `ssrRuntimeCapabilities` so controllers stay SSR-safe.
- **What exists before a browser does** — `staticParts` / `dynamicParts` /
  `isFullyServerRenderable` split each kind's anatomy into the closed
  control, which is markup a server can emit, and the overlay.

## What "SSR-safe" means here, and what it does not

The contract is computable without a DOM: every kind produces its whole view
contract — ids, ARIA, classes — in a process with no `document`, and
`browserRuntimeCapabilities()` probes for one rather than assuming it, so a
controller is never handed a command it cannot execute. `staticParts(kind)`
names the half of the anatomy a server can emit.

That is a guarantee about this package and nothing more. **It does not say a
form can be rendered on a server today**: producing markup, and hydrating a
client against it, belongs to a renderer, and this contract neither performs
nor requires it. A host building one gets a contract that will not reach for
the DOM underneath it, deterministic ids to hydrate against, and the
static/dynamic split to decide what to emit; the rendering itself is theirs.

The split is a statement about anatomy, not a rendering strategy. A renderer
that mounts its popup eagerly emits the dynamic parts while closed; one that
mounts lazily emits them on open. Both are conformant.
- **Conformance testing kit** (`@modyra/widgets/testing`) — fixtures and
  `runCommandExecutionTests()` to prove a new renderer honours the
  contract.

## Scope / non-scope

In scope: headless controllers and state machines; the intent/command
contract; the semantic state/view contract; deterministic ID policy;
conformance fixtures and testing kit.

Out of scope: a general DOM AST, a custom virtual DOM, node/portal/teleport
management, any direct DOM access from controllers.

## Why it exists

Every Modyra adapter renders the same controls. Encoding keyboard
navigation, focus management, ARIA wiring and overlay behavior **once** —
in a framework-free layer — is what keeps the Angular and Lit catalogs (and
any third-party renderer) behaviorally identical, verified by the theme
class parity check and the conformance kit.

## Usage

You rarely consume this package directly: adapters wrap the controllers.
To build a custom renderer, start from the select controller and the
conformance kit:

```ts
import { createSelectController } from "@modyra/widgets";
import { runCommandExecutionTests } from "@modyra/widgets/testing";
```

See the [UI toolkit guide](https://github.com/modyra/modyra/blob/main/docs/guides/ui-toolkit.md)
for the renderer-side contract (theme classes, parts, CSS tokens) and the
[Angular renderers](https://github.com/modyra/modyra/tree/main/packages/angular/src/lib/renderers)
for a complete implementation.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)


## Framework-agnostic UI contract

`@modyra/widgets` is the authoritative UI contract for Modyra presenters. Contract version 1 adds typed structural anatomy alongside controller state, intents, parts, commands and accessibility projection. The anatomy is metadata, not a virtual DOM. Angular is recorded as the protected golden semantic surface while its existing UI is migrated to consume this contract. Lit and Plain must subsequently implement the same contract rather than copying Angular internals.

The committed Angular baseline is verified with:

```bash
npm run test:widget-contract
```

A deliberate Angular semantic UI change requires regenerating and reviewing the baseline explicitly.
