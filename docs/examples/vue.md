# Vue — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in Vue: nested groups, a typed array of line items,
a coupon validated server-side (re-checked when the country changes,
cancelled while typing), submit with server errors, and a draft that
survives page refreshes.

```bash
npm install @modyra/vue
```

`createVueForm` runs the engine on `@vue/reactivity`, so calling
`form.f.*.value()` / `.errors()` / `.pending()` inside the template (or a
`computed`) tracks automatically — no hooks, no stores.

## The component

```vue
<script setup lang="ts">
import {
  array, createVueForm, crossField, field, group,
  min, pattern, required, serverValidator,
} from "@modyra/vue";
import { OrderApi } from "./order-api";

const form = createVueForm({
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

async function save(): Promise<void> {
  await form.submit(async (order) => {
    const res = await OrderApi.create(order);
    if (!res.ok) {
      // Returned errors land on the matching field (path: null → the form)
      return res.errors.map(e => ({ path: e.field, kind: "server", message: e.message }));
    }
  });
}
</script>

<template>
  <form @submit.prevent="save">
    <label>
      Country
      <select
        :value="form.f.country.value()"
        @change="form.f.country.set(($event.target as HTMLSelectElement).value)"
      >
        <option value="IT">Italy</option>
        <option value="DE">Germany</option>
        <option value="US">United States</option>
      </select>
    </label>

    <fieldset>
      <legend>Shipping address</legend>
      <label>
        City
        <input
          :value="form.f.shipping.city.value()"
          @input="form.f.shipping.city.set(($event.target as HTMLInputElement).value)"
          @blur="form.f.shipping.city.markAsTouched()"
        />
        <p v-if="form.f.shipping.city.touched() && form.f.shipping.city.errors()[0]" role="alert">
          {{ form.f.shipping.city.errors()[0].message }}
        </p>
      </label>
      <label>
        ZIP
        <input
          :value="form.f.shipping.zip.value()"
          @input="form.f.shipping.zip.set(($event.target as HTMLInputElement).value)"
          @blur="form.f.shipping.zip.markAsTouched()"
        />
      </label>
    </fieldset>

    <fieldset>
      <legend>Items</legend>
      <!-- rows() is tracked: v-for re-renders on push/insert/remove/move -->
      <div v-for="(row, i) in form.f.items.rows()" :key="i" class="item-row">
        <label>
          SKU #{{ i + 1 }}
          <input
            :value="row.sku.value()"
            @input="row.sku.set(($event.target as HTMLInputElement).value)"
            @blur="row.sku.markAsTouched()"
          />
          <p v-if="row.sku.touched() && row.sku.errors()[0]" role="alert">
            {{ row.sku.errors()[0].message }}
          </p>
        </label>
        <label>
          Qty
          <input
            type="number"
            :value="row.qty.value()"
            @input="row.qty.set(($event.target as HTMLInputElement).valueAsNumber)"
          />
        </label>
        <button type="button" @click="form.f.items.remove(i)">✕</button>
      </div>
      <p v-if="form.f.items.errors()[0]" role="alert">
        {{ form.f.items.errors()[0].message }}
      </p>
      <button type="button" @click="form.f.items.push({ sku: '', qty: 1 })">
        Add item
      </button>
    </fieldset>

    <label>
      {{ form.f.coupon.pending() ? "Coupon (checking…)" : "Coupon" }}
      <input
        :value="form.f.coupon.value()"
        @input="form.f.coupon.set(($event.target as HTMLInputElement).value)"
        @blur="form.f.coupon.markAsTouched()"
        :aria-invalid="!form.f.coupon.valid()"
      />
      <p v-if="form.f.coupon.errors()[0]" role="alert">
        {{ form.f.coupon.errors()[0].message }}
      </p>
    </label>

    <button type="submit" :disabled="!form.state.canSubmit()">Place order</button>
    <button type="button" @click="form.reset()">Reset</button>
  </form>
</template>
```

## What to notice

- **Native Vue reactivity** — handles are plain functions over
  `shallowRef`s, so templates track `value()`/`errors()`/`pending()` with
  zero wiring; `computed(() => form.state.valid())` works too.
- **Array rows in `v-for`** — `rows()` is a tracked signal of typed row
  handle trees; structural ops re-render the list, per-row errors come
  from `row.sku.errors()` like any other field.
- **Identical engine semantics** — the coupon's debounce, `dependsOn`
  re-validation, abort and `pending` behave exactly as in the Angular and
  React versions: same core, different binding.
- **Headless by design** — `@modyra/vue` ships the binding, not
  components; wrap your own UI library (or shadcn-vue) around the handles.

## Going further

- [`@modyra/vue` package README](../../packages/vue/README.md)
- [Multi-framework architecture](../guides/multi-framework.md) — the binding recipe (`@vue/reactivity` over the four primitives)
- [Typed forms guide](../guides/typed-forms.md) — the engine API, framework-free
