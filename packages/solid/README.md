# @modyra/solid

Solid binding for the [Modyra](https://github.com/modyra/modyra) form
engine: `solidReactivity()` implements the core's reactive contract on
Solid's native primitives (`createSignal`/`createMemo`/`createEffect`), so
form state participates in Solid's fine-grained reactivity directly.

```bash
npm install @modyra/solid
```

```ts
import { createSolidForm, field, required } from "@modyra/solid";

const form = createSolidForm({ email: field("", [required()]) });
// form.f.email.value() / errors() track inside createMemo/createEffect/JSX
```

## What's included

- **`createSolidForm(schema, options?)`** — typed form on Solid's
  reactivity.
- **`useSolidForm(schema, options?)`** — the same, destroyed automatically
  when the current owner (component or `createRoot`) is disposed.
- **The full core API** — `field`, `group`, `array`, `serverValidator`,
  `crossField`, drafts, undo/redo… re-exported from `@modyra/core`.

## Running in plain Node

solid-js's `package.json` maps the default Node import condition to a
non-reactive SSR stub (`dist/server.js` — signals/effects run once and
never notify). Any Node process that needs real reactivity — tests, a
server-rendered handler, a script — must run with `--conditions=browser`:

```bash
node --conditions=browser --test my-test.mjs
```

This package's own `npm test` already does this (see `package.json`).

## Headless widgets

`useMdyField`/`useMdySelect` wrap `@modyra/widgets`' framework-agnostic
controllers the same way `@modyra/vue` does — state and view exposed as
getters over Solid signals, so a `createMemo`/JSX expression reading
`api.state.value` tracks it natively:

```ts
import { useMdyField } from "@modyra/solid";

const email = useMdyField(form.f.email, { widgetId: "email", inputType: "email" });
// email.state.value / .invalid / .touched, email.view.parts.input.attributes
```

## Scope of this release

This release covers the reactivity bridge and the headless widgets
bridge — the same two layers `@modyra/vue` and `@modyra/react` are built
on. Not yet included (tracked as follow-up work): a framework example
under `examples/` and the headless-recipes doc section (shadcn/Radix-style
props mappers). Every core primitive — typed fields, arrays, async/server
validation, drafts, undo/redo — already works today through
`createSolidForm`/`useSolidForm`.
