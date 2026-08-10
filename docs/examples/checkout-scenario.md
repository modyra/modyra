# The shared checkout scenario

The seven framework examples all implement the same form: **one form, seven bindings**. A difference
between two of those pages is therefore a difference between two adapters, not between two authors.

This page describes the form once. Each adapter page covers only what its own binding does
differently. (`@modyra/plain` has [its own page](plain.md) — it renders a contract rather than this
scenario.)

## The shape

```
country          a select — changing it re-validates the coupon
coupon           validated on the server, debounced, cancelled while typing
shipping         a nested group
  city
  zip
items            a typed array of line items
  sku
  qty
```

Nested groups and the typed array are there because they are where a form library usually stops
being typed. `form.f.shipping.city` and `form.f.items` keep their types through the nesting, and
`getValue()` returns a shape that matches the schema rather than `Record<string, unknown>`.

## What each example exercises

| | |
| --- | --- |
| **Nested groups** | `shipping.city`, `shipping.zip` — typed access through a group |
| **A typed array** | `items`, with per-row fields and row add/remove |
| **Server validation** | the coupon is checked by a server call, debounced, and **cancelled** when the value changes while a request is in flight |
| **A dependency** | changing `country` re-validates the coupon, because a coupon can be valid in one country and not another |
| **Submit with server errors** | the server rejects and its field-level errors are mapped back onto the form |
| **Drafts** | the in-progress value survives a page refresh |

The cancellation and the dependency are the two that matter most and are the easiest to get wrong: a
stale response arriving after a newer one must not win, and a coupon must not stay valid because it
was valid for the previous country.

## Where the code is

Runnable applications live in `examples/<adapter>/`. The per-adapter pages in this directory —
[Angular](angular.md), [React](react.md), [Vue](vue.md), [Lit](lit.md), [Solid](solid.md),
[Preact](preact.md), [Svelte](svelte.md) — walk through the binding-specific part of each.

The same scenario is also the fixture Studio's own tests build against
(`packages/studio-model/test/fixtures/checkout.fixture.mjs`), so the shape is exercised by the
engine's suites and not only by the examples.

## What the examples do not show

They demonstrate **API compatibility**, not identical UI. Three adapters ship a rendered catalogue —
Angular, Lit and the framework-free renderer — and the rest are headless: you bring your own markup.
See [what "headless" means for conformance](../../README.md#what-headless-means-for-conformance).
