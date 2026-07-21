# @modyra/preact

Preact binding for the [Modyra](https://github.com/modyra/modyra) form
engine — a thin variant of `@modyra/react`: same `vanillaReactivity()` +
`useSyncExternalStore` pattern, ported to `preact/hooks` and
`preact/compat`.

```bash
npm install @modyra/preact
```

```tsx
import { useMdyForm, useMdyField } from "@modyra/preact";
import { field, required } from "@modyra/core";

function SignupForm() {
  const form = useMdyForm(() => ({ email: field("", [required()]) }));
  const email = useMdyField(form.f.email);
  return (
    <input
      value={email.value}
      onChange={(e) => form.f.email.set(e.currentTarget.value)}
      onBlur={email.markAsTouched}
    />
  );
}
```

## What's included

- **`useMdyForm(schemaFn, options?)`** — one typed form per component
  instance, destroyed on unmount.
- **`useMdyField(handle)`** — subscribes to a single field via
  `useSyncExternalStore` (from `preact/compat`).
- **`createStore`/`createFieldStore`** — the framework-free store the hooks
  wrap, directly testable in Node with no Preact renderer.
- **The headless widgets bridge** — `useMdyField`/`useMdySelect`/
  `useMdyCommandQueue` from `@modyra/widgets`' controllers, same shape as
  the React adapter's (only the hook import source differs: `preact/hooks`
  instead of `react`).
- **The full core API** — `field`, `group`, `array`, `serverValidator`,
  `crossField`, drafts, undo/redo… re-exported from `@modyra/core`.

## Headless recipes

The shadcn/Radix prop-mapper recipes in
[`docs/guides/headless-recipes.md`](../../docs/guides/headless-recipes.md)
work unchanged: they only touch the framework-agnostic field handle, never
a React/Preact API. `packages/preact/test/headless-recipes.test.mjs` is the
React adapter's suite ported verbatim, proving the claim rather than just
asserting it.
