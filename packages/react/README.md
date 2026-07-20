# @modyra/react

React binding for the [Modyra](https://github.com/modyra/modyra) form
engine. React has no signal primitive, so the engine runs on the core's
vanilla reactive graph and components subscribe via `useSyncExternalStore`.

```bash
npm install @modyra/react
```

```tsx
import { useMdyForm, useMdyField, field, required } from "@modyra/react";

function Signup() {
  const form = useMdyForm(() => ({ email: field("", [required()]) }));
  const email = useMdyField(form.f.email);
  return (
    <input
      value={email.value}
      onChange={(e) => email.set(e.target.value)}
      onBlur={email.markAsTouched}
      aria-invalid={!email.valid}
    />
  );
}
```

## What's included

- **`useMdyForm(schema, options?)`** — creates (once) a typed form on the
  vanilla graph; destroyed on unmount (draft/history/async timers released).
- **`useMdyField(handle)`** — subscribes the component to one field:
  `{ value, errors, touched, dirty, valid, pending, disabled, set, markAsTouched }`.
- **`createStore(signals)` / `createFieldStore(handle)`** — framework-free
  subscription stores (tested in Node) behind the hooks; use them to
  subscribe to anything else (`rows()`, `canSubmit()`…).
- **The full core API** — `field`, `group`, `array`, `serverValidator`,
  `crossField`, drafts, undo/redo… re-exported from `@modyra/core`.

## Typed arrays and async validation

Everything the core does works here — same code, React subscription:

```tsx
const form = useMdyForm(() => ({
  items: array(group({ sku: field(""), qty: field<number>(1) })),
  coupon: field(
    "",
    [],
    serverValidator(checkCoupon, {
      dependsOn: ["country"],
      debounceMs: 400,
      timeoutMs: 5000,
    }),
  ),
}));

form.f.items.rows().map((row, i) => <Row key={i} handle={row} />);
```

A complete checkout (nested groups, array rows, cancellable server
validation, submit errors, drafts) lives in
[docs/examples/react.md](https://github.com/modyra/modyra/blob/main/docs/examples/react.md).

## Status

Early (0.x) — stores and hooks are implemented and tested; ready-made
components are intentionally out of scope (headless: bring your own design
system). Pin your version and read release notes.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
