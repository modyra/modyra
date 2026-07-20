# React — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in React: nested groups, a typed array of line
items, a coupon validated server-side (re-checked when the country
changes, cancelled while typing), submit with server errors, and a draft
that survives page refreshes.

```bash
npm install @modyra/react
```

React has no signal primitive, so the form runs on the core's vanilla
reactive graph and components subscribe through `useSyncExternalStore`.
`useMdyField` covers a single field handle; the 8-line `useSignals`
helper below subscribes to anything else (`rows()`, `canSubmit()`…).

## The component

```tsx
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  array, createStore, crossField, field, group, min, pattern,
  required, serverValidator, useMdyField, useMdyForm,
} from "@modyra/react";
import type { MdySignal } from "@modyra/react";
import { OrderApi } from "./order-api";

/** Subscribe the component to any set of engine signals. */
function useSignals(signals: ReadonlyArray<MdySignal<unknown>>): void {
  const store = useMemo(() => createStore(signals), signals);
  useEffect(() => () => store.destroy(), [store]);
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function Checkout() {
  const form = useMdyForm(() => ({
    country: field("IT"),
    shipping: group({
      city: field("", [required()]),
      zip: field("", [required(), pattern(/^\d{5}$/, "5 digits")]),
    }),
    items: array(
      group({
        sku: field("", [required()]),
        qty: field<number>(1, [min(1)]),
      }),
      { initial: [{ sku: "TSHIRT-BLK-M", qty: 2 }] },
    ),
    coupon: field("", [], serverValidator(
      async (code, ctx) => {
        if (!code) return null;
        const res = await OrderApi.checkCoupon(code, ctx.form.fieldValue("country"), {
          signal: ctx.signal, // aborted automatically when stale
        });
        return res.valid ? null : "Coupon not valid for your country";
      },
      { dependsOn: ["country"], debounceMs: 400, timeoutMs: 5000 },
    )),
  }), {
    validators: [
      crossField(["items"], (v) =>
        v.items.length === 0 ? "Add at least one item to the order" : null),
    ],
    draft: { key: "checkout-draft", exclude: ["coupon"] },
  });

  // Re-render when the row structure, array errors or submit-ability change.
  useSignals([form.f.items.rows, form.f.items.errors, form.state.canSubmit]);

  const country = useMdyField(form.f.country);
  const coupon = useMdyField(form.f.coupon);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.submit(async (order) => {
          const res = await OrderApi.create(order);
          if (!res.ok) {
            return res.errors.map(e => ({ path: e.field, kind: "server", message: e.message }));
          }
        });
      }}
    >
      <label>
        Country
        <select value={country.value} onChange={(e) => country.set(e.target.value)}>
          <option value="IT">Italy</option>
          <option value="DE">Germany</option>
          <option value="US">United States</option>
        </select>
      </label>

      <fieldset>
        <legend>Shipping address</legend>
        <TextField handle={form.f.shipping.city} label="City" />
        <TextField handle={form.f.shipping.zip} label="ZIP" />
      </fieldset>

      <fieldset>
        <legend>Items</legend>
        {form.f.items.rows().map((row, i) => (
          <div className="item-row" key={i}>
            <TextField handle={row.sku} label={`SKU #${i + 1}`} />
            <NumberField handle={row.qty} label="Qty" />
            <button type="button" onClick={() => form.f.items.remove(i)}>✕</button>
          </div>
        ))}
        {form.f.items.errors()[0] && (
          <p role="alert">{form.f.items.errors()[0].message}</p>
        )}
        <button type="button" onClick={() => form.f.items.push({ sku: "", qty: 1 })}>
          Add item
        </button>
      </fieldset>

      <label>
        {coupon.pending ? "Coupon (checking…)" : "Coupon"}
        <input
          value={coupon.value}
          onChange={(e) => coupon.set(e.target.value)}
          onBlur={coupon.markAsTouched}
          aria-invalid={!coupon.valid}
        />
      </label>
      {coupon.errors[0] && <p role="alert">{coupon.errors[0].message}</p>}

      <button type="submit" disabled={!form.state.canSubmit()}>Place order</button>
      <button type="button" onClick={() => form.reset()}>Reset</button>
    </form>
  );
}

/** Minimal controlled bindings — or wrap your design system instead. */
function TextField({ handle, label }: { handle: any; label: string }) {
  const f = useMdyField(handle);
  return (
    <label>
      {label}
      <input
        value={f.value}
        onChange={(e) => f.set(e.target.value)}
        onBlur={f.markAsTouched}
        aria-invalid={!f.valid}
      />
      {f.touched && f.errors[0] && <p role="alert">{f.errors[0].message}</p>}
    </label>
  );
}

function NumberField({ handle, label }: { handle: any; label: string }) {
  const f = useMdyField(handle);
  return (
    <label>
      {label}
      <input
        type="number"
        value={f.value ?? ""}
        onChange={(e) => f.set(e.target.valueAsNumber)}
        onBlur={f.markAsTouched}
        aria-invalid={!f.valid}
      />
      {f.touched && f.errors[0] && <p role="alert">{f.errors[0].message}</p>}
    </label>
  );
}
```

## What to notice

- **One subscription model** — `useMdyField` for field handles,
  `useSignals` (built on the exported `createStore`) for everything else.
  No context provider, no form-specific state library.
- **Array rows are typed handles** — `rows().map()` yields per-row handle
  trees (`row.sku`, `row.qty`) that feed the same controlled inputs as any
  other field. Structure changes re-render via `useSignals([rows])`.
- **The coupon logic lives in the engine** — debounce, `dependsOn`
  re-validation, abort of stale fetches and the `pending` flag all work
  identically to the Angular and Vue versions, because they *are* the same
  code running on a different reactive binding.
- **Headless by design** — `@modyra/react` ships no components: the
  `TextField` wrappers above are the seam where your design system
  (shadcn/ui, MUI, …) plugs in.

## Going further

- [`@modyra/react` package README](../../packages/react/README.md)
- [Multi-framework architecture](../guides/multi-framework.md) — how the binding works (`useSyncExternalStore` over the vanilla graph)
- [Typed forms guide](../guides/typed-forms.md) — the engine API, framework-free
