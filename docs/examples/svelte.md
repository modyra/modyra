# Svelte — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in Svelte: nested groups, a typed array of line
items, a coupon validated server-side (re-checked when the country
changes, cancelled while typing), submit with server errors, and a draft
that survives page refreshes.

```bash
npm install @modyra/svelte
```

Svelte 5's runes (`$state`/`$derived`) are compiler macros — they only
work inside a `.svelte` file, not in a plain npm package's own build. So
`@modyra/svelte` runs the engine on the core's `vanillaReactivity()` (same
as React/Preact) and `toStore()` adapts any Modyra signal into a real
Svelte `Readable`, so a `.svelte` template writes `{$emailStore}` and
subscribes the native way — no `useMdyField`-style hook to learn.

## The component

```svelte
<!-- Checkout.svelte -->
<script>
  import {
    array, createSvelteForm, crossField, field, group, min, pattern,
    required, serverValidator, toStore,
  } from "@modyra/svelte";
  import { OrderApi } from "./order-api";

  const form = createSvelteForm({
    country: field("IT"),
    shipping: group({
      city: field("", [required()]),
      zip: field("", [required(), pattern(/^\d{5}$/, "5 digits")]),
    }),
    items: array(
      group({
        sku: field("", [required()]),
        qty: field(1, [min(1)]),
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

  const itemRows = toStore(form.f.items.rows);
  const itemErrors = toStore(form.f.items.errors);
  const canSubmit = toStore(form.state.canSubmit);
  const couponValue = toStore(form.f.coupon.value);
  const couponPending = toStore(form.f.coupon.pending);
  const couponValid = toStore(form.f.coupon.valid);
  const couponErrors = toStore(form.f.coupon.errors);

  function submit(e) {
    e.preventDefault();
    form.submit(async (order) => {
      const res = await OrderApi.create(order);
      if (!res.ok) {
        return res.errors.map((e) => ({ path: e.field, kind: "server", message: e.message }));
      }
    });
  }
</script>

<form class="mdy-form" on:submit={submit}>
  <label>
    Country
    <select value={form.f.country.value()} on:change={(e) => form.f.country.set(e.target.value)}>
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
    {#each $itemRows as row, i}
      <div class="item-row">
        <TextField handle={row.sku} label={`SKU #${i + 1}`} />
        <TextField handle={row.qty} label="Qty" type="number" />
        <button type="button" on:click={() => form.f.items.remove(i)}>✕</button>
      </div>
    {/each}
    {#if $itemErrors[0]}
      <p role="alert">{$itemErrors[0].message}</p>
    {/if}
    <button type="button" on:click={() => form.f.items.push({ sku: "", qty: 1 })}>
      Add item
    </button>
  </fieldset>

  <label>
    {$couponPending ? "Coupon (checking…)" : "Coupon"}
    <input
      value={$couponValue}
      on:input={(e) => form.f.coupon.set(e.target.value)}
      on:blur={() => form.f.coupon.markAsTouched()}
      aria-invalid={!$couponValid}
    />
  </label>
  {#if $couponErrors[0]}<p role="alert">{$couponErrors[0].message}</p>{/if}

  <button type="submit" disabled={!$canSubmit}>Place order</button>
  <button type="button" on:click={() => form.reset()}>Reset</button>
</form>
```

`TextField.svelte` wraps a single handle the same way as the monorepo
[`examples/svelte`](../../examples/svelte) demo: `toStore()` each property
you read (`value`, `errors`, `touched`, `valid`), bind `on:input`/`on:blur`
to `handle.set`/`handle.markAsTouched`. See that example's
[`TextField.svelte`](../../examples/svelte/TextField.svelte) for the exact
pattern.

## What to notice

- **`toStore()` is the whole bridge** — every reactive read in the
  template goes through it once (`const x = toStore(handle.y)`), then
  `$x` in markup is native Svelte auto-subscription. No hook, no manual
  `onDestroy` — `toStore()`'s returned `Readable` unsubscribes itself when
  Svelte's own reactivity stops observing it.
- **One honest caveat**: `toStore()`-backed updates are microtask-batched
  (like every other effect-driven feature in the engine — async
  validators, drafts, history), not perfectly synchronous the way
  Svelte's own `writable()` is. The template still re-renders correctly,
  just one microtask after the underlying value changes rather than in
  the same tick.
- **The coupon logic lives in the engine** — same debounce/`dependsOn`/
  abort/`pending` behavior as every other adapter.
- **Headless by design** — `@modyra/svelte` ships no components: wrap your
  own design system around the handles the same way `TextField.svelte`
  does above.

## Going further

- [`@modyra/svelte` package README](../../packages/svelte/README.md)
- [Monorepo example](../../examples/svelte) — the full runnable signup demo this scenario is adapted from
- [Multi-framework architecture](../guides/multi-framework.md) — how the binding works, why stores instead of runes
- [Typed forms guide](../guides/typed-forms.md) — the engine API, framework-free
