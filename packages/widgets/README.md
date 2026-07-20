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
