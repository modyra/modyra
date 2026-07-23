# Solid — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in Solid: nested groups, a typed array of line
items, a coupon validated server-side (re-checked when the country
changes, cancelled while typing), submit with server errors, and a draft
that survives page refreshes.

```bash
npm install @modyra/solid
```

Solid's primitives map almost 1:1 onto the engine's reactive contract
(`createSignal` → signal, `createMemo` → computed, `createEffect` →
effect), so there is no `useMdyField`-style hook here at all: field
handles are read directly as accessors inside JSX (`handle.value()`),
and Solid's compiler wraps each such read in its own fine-grained update
— no whole-component re-render, no subscription wiring to write.

## The component

```tsx
import { useSolidForm, array, crossField, field, group, min, pattern, required, serverValidator } from "@modyra/solid";
import { OrderApi } from "./order-api";

function TextField(props: { handle: any; label: string }) {
  return (
    <label>
      {props.label}
      <input
        value={props.handle.value() ?? ""}
        onInput={(e) => props.handle.set(e.target.value)}
        onBlur={props.handle.markAsTouched}
        aria-invalid={!props.handle.valid()}
      />
      {props.handle.touched() && props.handle.errors()[0] && (
        <p role="alert">{props.handle.errors()[0].message}</p>
      )}
    </label>
  );
}

function NumberField(props: { handle: any; label: string }) {
  return (
    <label>
      {props.label}
      <input
        type="number"
        value={props.handle.value() ?? ""}
        onInput={(e) => props.handle.set(e.target.valueAsNumber)}
        onBlur={props.handle.markAsTouched}
        aria-invalid={!props.handle.valid()}
      />
      {props.handle.touched() && props.handle.errors()[0] && (
        <p role="alert">{props.handle.errors()[0].message}</p>
      )}
    </label>
  );
}

export function Checkout() {
  const form = useSolidForm({
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
  }, {
    validators: [
      crossField(["items"], (v) =>
        v.items.length === 0 ? "Add at least one item to the order" : null),
    ],
    draft: { key: "checkout-draft", exclude: ["coupon"] },
  });

  const submit = (e: Event) => {
    e.preventDefault();
    void form.submit(async (order) => {
      const res = await OrderApi.create(order);
      if (!res.ok) {
        return res.errors.map(e => ({ path: e.field, kind: "server", message: e.message }));
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <label>
        Country
        <select value={form.f.country.value()} onInput={(e) => form.f.country.set(e.target.value)}>
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
        <For each={form.f.items.rows()}>
          {(row, i) => (
            <div class="item-row">
              <TextField handle={row.sku} label={`SKU #${i() + 1}`} />
              <NumberField handle={row.qty} label="Qty" />
              <button type="button" onClick={() => form.f.items.remove(i())}>✕</button>
            </div>
          )}
        </For>
        {form.f.items.errors()[0] && (
          <p role="alert">{form.f.items.errors()[0].message}</p>
        )}
        <button type="button" onClick={() => form.f.items.push({ sku: "", qty: 1 })}>
          Add item
        </button>
      </fieldset>

      <label>
        {form.f.coupon.pending() ? "Coupon (checking…)" : "Coupon"}
        <input
          value={form.f.coupon.value()}
          onInput={(e) => form.f.coupon.set(e.target.value)}
          onBlur={form.f.coupon.markAsTouched}
          aria-invalid={!form.f.coupon.valid()}
        />
      </label>
      {form.f.coupon.errors()[0] && <p role="alert">{form.f.coupon.errors()[0].message}</p>}

      <button type="submit" disabled={!form.state.canSubmit()}>Place order</button>
      <button type="button" onClick={() => form.reset()}>Reset</button>
    </form>
  );
}
```

(`For` is Solid's own keyed-list control-flow component, imported from
`solid-js` — used here instead of `.map()` so row removal/insertion stays
fine-grained instead of re-rendering the whole list.)

## What to notice

- **No subscription layer to write** — every `handle.value()` call is a
  Solid signal read; the compiler tracks it and updates only that DOM
  node. Where React needs `useMdyField`/`useSignals`, Solid needs nothing.
- **`useSolidForm`, not `createSolidForm`** — the `use` variant disposes
  the form automatically when the enclosing owner (component or
  `createRoot`) cleans up; `createSolidForm` is available if you want to
  manage the lifecycle yourself.
- **The coupon logic lives in the engine** — debounce, `dependsOn`
  re-validation, abort of stale fetches and the `pending` flag are the
  same code as every other adapter, running on Solid's own reactive graph
  instead of a bridge.
- **Headless by design** — `@modyra/solid` ships no components: the
  `TextField`/`NumberField` wrappers above are the seam where your design
  system plugs in.

## Going further

- [`@modyra/solid` package README](../../packages/solid/README.md)
- [Multi-framework architecture](../guides/multi-framework.md) — how the binding works, and the `--conditions=browser` note for Node/SSR
- [Typed forms guide](../guides/typed-forms.md) — the engine API, framework-free
