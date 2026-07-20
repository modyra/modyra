# @modyra/vue

Vue binding for the [Modyra](https://github.com/modyra/modyra) form engine:
`vueReactivity()` implements the core's reactive contract on
`@vue/reactivity` (shallowRef/computed/effect), so form state participates
in Vue reactivity natively.

```bash
npm install @modyra/vue
```

```ts
import { createVueForm, field, required } from "@modyra/vue";

const form = createVueForm({ email: field("", [required()]) });
// form.f.email.value() / errors() react inside computed(), watchers, templates
```

In templates, calling `form.f.*.value()` / `.errors()` / `.pending()`
tracks automatically — no hooks, no stores.

## What's included

- **`createVueForm(schema, options?)`** — typed form on `@vue/reactivity`.
- **`useVueForm(schema, options?)`** — the same, disposed with the
  component setup scope.
- **The full core API** — `field`, `group`, `array`, `serverValidator`,
  `crossField`, drafts, undo/redo… re-exported from `@modyra/core`.

## Typed arrays and async validation

Everything the core does works here — same code, Vue reactivity:

```ts
const form = createVueForm({
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
});
```

```vue
<div v-for="(row, i) in form.f.items.rows()" :key="i">
  <input :value="row.sku.value()" @input="row.sku.set($event.target.value)" />
</div>
```

A complete checkout (nested groups, array rows, cancellable server
validation, submit errors, drafts) lives in
[docs/examples/vue.md](https://github.com/modyra/modyra/blob/main/docs/examples/vue.md).

## Status

Early (0.x) — the reactivity binding and typed form factory are
implemented and tested; ready-made Vue components are intentionally out of
scope (headless: bring your own design system). Pin your version and read
release notes.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
