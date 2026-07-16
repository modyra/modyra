# @modyra/react

React binding for the [Modyra](https://github.com/modyra/modyra) form
engine. React has no signal primitive, so the engine runs on the core's
vanilla reactive graph and components subscribe via `useSyncExternalStore`.

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

Status: early (0.1.0) — stores and hooks are implemented (stores are
framework-free and tested in Node); ready-made components are future work.
