# @modyra/svelte

Svelte binding for the [Modyra](https://github.com/modyra/modyra) form
engine — typed forms as real Svelte stores.

```bash
npm install @modyra/svelte
```

```ts
import { createSvelteForm, field, required, toStore } from "@modyra/svelte";

const form = createSvelteForm({ email: field("", [required()]) });
const email = toStore(form.f.email.value); // a real Readable
```

```svelte
<script>
  import { form, email } from "./form";
</script>

<input value={$email} on:input={(e) => form.f.email.set(e.target.value)} />
```

## Why stores, not runes

Svelte 5's runes (`$state`/`$derived`/`$effect`) are **compiler macros** —
they only work inside a `.svelte` file or a `.svelte.js`/`.svelte.ts`
module that goes through the Svelte compiler. A plain, `tsc`-built npm
package (this one) cannot use them: calling `$state()` in ordinary
JavaScript throws a `ReferenceError`.

`svelte/store` (`writable`/`derived`/`get`, the `Readable` contract), by
contrast, is real, uncompiled JavaScript that has worked outside `.svelte`
files since Svelte 3 — and Svelte 5 still fully supports it. So this
package runs the engine on `vanillaReactivity()` (the same core graph
`@modyra/react` and `@modyra/preact` use — Svelte has no more of an
exported fine-grained signal than React does) and `toStore()` adapts any
Modyra signal into a real `Readable`, so a `.svelte` template's native
`$store` syntax subscribes to it directly.

**One honest caveat**: `toStore()` wraps an *effect*, so — like every
other effect-driven feature in the engine (async validators, drafts,
undo/redo history) — later notifications are microtask-batched, not
perfectly synchronous the way Svelte's own `writable()` is. A component
still re-renders correctly on every change, just one microtask after the
underlying value updates rather than in the same tick.

A runes-based ergonomic layer (a `@modyra/svelte/runes` subpath built
through the Svelte compiler, e.g. via `@sveltejs/package`) is possible as
a follow-up, but is a separate, larger toolchain decision — this package
deliberately stays `tsc`-only, testable with plain `node --test` like
every other adapter in this repo.

## Headless widgets

`useMdyField`/`useMdySelect` wrap `@modyra/widgets`' framework-agnostic
controllers the same way `createSvelteForm` wraps the engine — state and
view come back as real `Readable` stores (via the same `toStore()`
bridge), so a `.svelte` template's native `$state`/`$view` syntax
subscribes directly:

```ts
import { useMdyField } from "@modyra/svelte";

const email = useMdyField(form.f.email, { widgetId: "email", inputType: "email" });
```

```svelte
<input {...$email.view.parts.input.attributes} value={$email.state.value} />
```

Same microtask-batching caveat as `toStore()` above: a dispatched intent
(`email.dispatch({ type: "input", value: ... })`) is reflected in
`$email.state` one microtask later, not synchronously.

## What's included

- **`createSvelteForm(schema, options?)`** — typed form on the vanilla
  reactive graph.
- **`toStore(signal)`** — adapts any Modyra signal (a field's
  `.value`/`.errors`/`.valid`…, or `form.state.canSubmit`, `form.canUndo`,
  …) into a real Svelte `Readable`.
- **`useMdyField`/`useMdySelect`/`executeSvelteCommands`** — the headless
  widgets bridge, same shape as `@modyra/vue`'s and `@modyra/solid`'s.
- **The full core API** — `field`, `group`, `array`, `serverValidator`,
  `crossField`, drafts, undo/redo… re-exported from `@modyra/core`.

## Scope of this release

This release covers the reactivity bridge and the headless widgets
bridge — the same two layers `@modyra/vue`/`@modyra/solid` are built on.
Not yet included (tracked as follow-up work): a framework example under
`examples/` (needs a Svelte-aware bundler — `@sveltejs/vite-plugin-svelte`
— for a real `.svelte` component, a separate decision from the
runes-vs-stores one above) and the headless-recipes doc section.
