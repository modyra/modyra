# @modyra/react

React binding for the [Modyra](https://github.com/modyra/modyra) form
engine. React has no signal primitive, so the engine runs on the core's
vanilla reactive graph and components subscribe via `useSyncExternalStore`.

> **Headless.** This package renders no markup — you bring your own. Modyra's DOM conformance
> suites (anatomy, state matrix, renderer equivalence) check the three adapters that *do* render;
> they do not apply here, because there is no part to find and no rendered state to compare. What
> this package promises — value, validation, error and lifecycle semantics — is checked by its own
> suites and the shared reactivity capability tests. Accessibility and theming are yours;
> `@modyra/widgets` exports the same projections, id policy and class vocabulary the rendering
> adapters use, so your markup can be built from the contract rather than guessed.


```bash
npm install @modyra/react
```

```tsx
import { useMdyForm, useMdyField, field, required } from "@modyra/react";
import { projectFieldShellA11y } from "@modyra/widgets";

function Signup() {
  const form = useMdyForm(() => ({ email: field("", [required()]) }));
  const email = useMdyField(form.f.email);

  // The contract answers what the markup should say; this component binds and draws.
  const parts = projectFieldShellA11y(
    { disabled: email.disabled, required: true },
    email.errors,
    { widgetId: "signup-email", label: "Email", errorsVisible: email.touched },
  );

  return (
    <label id={parts.label.id} className={parts.label.classes.join(" ")}>
      Email
      <input
        {...parts.control.attributes}
        value={email.value}
        onChange={(e) => email.set(e.target.value)}
        onBlur={email.markAsTouched}
      />
    </label>
  );
}
```

**Do not write `aria-invalid={!email.valid}`.** It is the obvious line and it is a different rule
from the one every rendering adapter follows: whether a control announces itself as failing depends
on whether the person is *being told yet* — a field they have not reached does not accuse them, and a
disabled field states no verdict at all. `projectFieldShellA11y` answers that once, and hands back four parts: the
control's eleven attributes — `aria-invalid`, `aria-required`, `aria-describedby`, `aria-disabled`,
`aria-readonly` and the constraint attributes — plus the ids and classes the label, description and
error list carry. Written out at each call site instead, nine
of them decided it separately and one told a person their field was required before they had reached
it.

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

Below 1.0, so the public surface can change in a minor release — pin your version and read the
release notes. The stores and hooks are implemented and tested. Ready-made components are
deliberately out of scope: this adapter is headless, and you bring your own design system.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
