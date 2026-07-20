# @modyra/core

**Framework-agnostic, type-safe form engine.** Typed field trees and
arrays, sync/async/cross-field validation, dirty/touched tracking, draft
persistence, undo/redo and minimal-patch change tracking — with zero
dependencies and no framework in sight.

```ts
import { createForm, field, group, required, min } from "@modyra/core";

const form = createForm({
  email: field("", [required()]),
  age: field<number | null>(null, [min(18)]),
  address: group({ city: field("Rome") }),
});

form.f.email.set("foo@bar.com");
form.f.email.errors(); // []
form.getValue().address.city; // typed — typos do not compile
```

Runs in Node, CLIs, workers and plain unit tests.

## Feature tour

**Typed field arrays** — repeatable rows with compile-checked paths:

```ts
import { array, field, group, min } from "@modyra/core";

const form = createForm({
  items: array(group({ sku: field(""), qty: field<number>(1, [min(1)]) }), {
    initial: [{ sku: "TSHIRT-BLK-M", qty: 2 }],
  }),
});

form.f.items.push({ sku: "MUG-WHT", qty: 1 });
form.f.items.rows()[1].sku.errors();
form.f.items.move(0, 1);
form.getValue().items[0].qty; // number
```

**Server-side async validation, done right** — cancellable, cross-field,
debounced, with timeout and preconditions:

```ts
import { field, serverValidator } from "@modyra/core";

coupon: field(
  "",
  [],
  serverValidator(
    async (code, ctx) => {
      if (!code) return null;
      const res = await api.check(code, ctx.form.fieldValue("country"), {
        signal: ctx.signal, // aborted when the run is superseded
      });
      return res.valid ? null : "Coupon not valid for your country";
    },
    { dependsOn: ["country"], debounceMs: 400, timeoutMs: 5000 },
  ),
);
```

**Drafts, history, minimal patches:**

```ts
const form = createForm(schema, {
  draft: { key: "checkout", exclude: ["iban"] }, // autosave/restore, TTL'd
  history: true, // undo()/redo()
});
form.getChanges(); // → typed minimal patch for your PATCH endpoint
```

**Cross-field validation** — form-level rules over the whole typed value,
attributed to fields or to the form itself (`path: null`):

```ts
import { crossField } from "@modyra/core";

createForm(schema, {
  validators: [
    crossField(["passwordConfirm"], (v) =>
      v.password !== v.passwordConfirm ? "Passwords do not match" : null,
    ),
  ],
});
```

## The reactive contract

The engine is written against four primitives — `signal`, `computed`,
`effect` (with cleanup) and `untracked` — the common denominator of
fine-grained reactivity (Solid, Preact Signals, Vue, Angular Signals, and
the TC39 Signals proposal). It is **not** an Angular API: Angular is just
one binding of the contract.

```ts
import { createForm, vanillaReactivity } from "@modyra/core";

// Node / tests / workers: the bundled graph
const form = createForm(schema); // reactivity defaults to vanillaReactivity()
```

Framework adapters (`@modyra/angular`, `@modyra/react`, `@modyra/vue`,
`@modyra/lit`) pass their own implementation so form state participates
natively in the host's change detection.

## Security notes

- Drafts are versioned envelopes with a 7-day TTL; `File`/`Blob`/`BigInt`
  values are refused, quota errors never crash the form, and prototype-
  pollution paths (`__proto__` & co.) in tampered storage are discarded.
- The framework-agnostic devtools panel masks sensitive-looking paths and
  escapes every rendered value.
- Zero runtime dependencies, SSR-safe (no `window`/`document` access in
  the engine).

## Documentation

- [Real-world agnostic scenarios](https://github.com/modyra/modyra#real-world-scenarios-handled-by-the-engine)
- [Typed forms guide](https://github.com/modyra/modyra/blob/main/docs/guides/typed-forms.md)
- [Mental model](https://github.com/modyra/modyra/blob/main/docs/guides/mental-model.md)

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
