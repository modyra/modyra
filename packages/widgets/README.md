# @modyra/widgets

Headless widget controllers and the universal interaction/accessibility
contract shared by every [Modyra](https://github.com/modyra/modyra)
renderer — framework components, custom elements, or your own design system.

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

## Checking your own renderer

```bash
npx modyra-conformance ./my-adapter.config.mjs
```

The suites this repository runs against its own renderers, behind one entry point. Your config says
which kinds you draw and how to mount one, and owns its environment — a renderer needs a DOM and only
you know how yours is set up:

```js
export const name  = "@acme/renderer";
export const kinds = ["text", "select"];
export async function mount(kind) { /* → an MdyStateFixture */ }

// Optional.
export const absentParts = { select: ["empty"] };   // what a kind legitimately does not render at rest
export const mountScoped = (kind, scope) => { … };  // two instances that must not share ids
```

It reports DOM anatomy and relations, the state matrix, renderer equivalence at rest, lifecycle, and
multi-instance isolation. **Keyboard behaviour and an accessibility audit are reported as not run**,
with the reason: focus, native key defaults and computed accessible names are not answerable outside
a real browser, and a green there would mean nothing.

## Contract data and checker data

Two kinds of export live here, and the difference decides whether *you* should
read one.

**Contract data** is what a renderer implements: the catalogue
(`MDY_WIDGET_CONTRACTS`), the relations, the keyboard bindings, the projections
(`projectFieldA11y`, `projectOverlayOpenerA11y`, …), the id policy, the state
and class vocabularies. If a renderer ignores any of it, it renders a different
widget. Read these.

**Checker data** describes how conformance is *measured*, not what a widget owes:

| | |
| --- | --- |
| `MDY_WIDGET_STATE_SUPPORT`, `widgetSupportsState`, `widgetStateMatrixSize` | which `kind × state` pairs a matrix should contain, and how many |
| `transitionsFrom`, `MDY_DISABLED_BLOCKS_TRANSITIONS` | which transitions a suite should drive |
| `MDY_LABELABLE_TAGS` | which tags `for=` may legally point at, so a checker can tell a wrong label from an unlabelable control |

A renderer that reads these is asking the marking scheme what to write. It gains
nothing: every fact they encode is already implied by the contract data it
implements. They are exported because a **third-party conformance harness**
needs them — the same reason `@modyra/widgets/testing` is public — and for no
other reason.

The rule, if you need one: **if ignoring it would change what the user sees, it
is contract data. If ignoring it would only change what a test reports, it is
checker data.**

## Why it exists

Every renderer draws the same controls. Encoding keyboard navigation, focus
management, ARIA wiring and overlay behavior **once**, in a framework-free
layer, is what makes two renderers behaviorally identical rather than
coincidentally similar — and it is what the conformance kit and the theme
class parity check verify.

This package is the authoritative UI contract: controller state, intents,
parts, commands, typed structural anatomy and accessibility projection. The
anatomy is metadata, **not a virtual DOM** — it says what a part is and where
it sits, never how to create it. A renderer implements the contract; it does
not copy another renderer.

## Usage

You rarely consume this package directly: adapters wrap the controllers.
To build a custom renderer, start from the select controller and the
conformance kit:

```ts
import { createSelectController } from "@modyra/widgets";
import { runCommandExecutionTests } from "@modyra/widgets/testing";
```

See the [UI toolkit guide](https://github.com/modyra/modyra/blob/main/docs/guides/ui-toolkit.md)
for the renderer-side contract: theme classes, parts and CSS tokens.

## Verifying a renderer against it

```bash
npm run test:widget-contract   # the committed semantic baseline
npx modyra-conformance <config>  # a renderer's own DOM, states and equivalence
```

The baseline is a golden surface: a deliberate semantic change requires
regenerating and reviewing it explicitly, so a silent one fails instead of
being absorbed.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
