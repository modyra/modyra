# Lit — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in Lit: nested groups, a typed array of line items
rendered from `rows()`, a coupon validated server-side (re-checked when the
country changes, cancelled while typing), submit with server errors, and a
draft that survives page refreshes.

```bash
npm install @modyra/lit @modyra/styles
```

`createLitForm` runs the engine on Lit's reactivity; `MdyFormController`
re-renders the host when any tracked signal changes. The ready-made
`<mdy-*-field>` elements (from `@modyra/lit/ui`) bind via `.field` and pick
up the shipped CSS themes — and because they are web components, this same
catalog also works from Angular/React/Vue templates.

## The component

```ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import {
  array, createLitForm, crossField, field, group, MdyFormController,
  min, pattern, required, serverValidator,
} from "@modyra/lit/adapter";
import { defineMdyElements } from "@modyra/lit/ui";
import { OrderApi } from "./order-api";

defineMdyElements(); // registers <mdy-text-field>, <mdy-number-field>, …

@customElement("app-checkout")
export class CheckoutElement extends LitElement {
  // Light DOM: the shipped @modyra/styles themes apply unchanged.
  protected createRenderRoot() {
    return this;
  }

  private readonly form = createLitForm({
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

  // Track everything this render() reads — structure, pending, validity.
  private readonly tracker = new MdyFormController(this, [
    this.form.f.items.rows,
    this.form.f.items.errors,
    this.form.f.coupon.pending,
    this.form.state.canSubmit,
  ]);

  private async save(e: Event): Promise<void> {
    e.preventDefault();
    await this.form.submit(async (order) => {
      const res = await OrderApi.create(order);
      if (!res.ok) {
        return res.errors.map(err => ({ path: err.field, kind: "server", message: err.message }));
      }
    });
  }

  render() {
    return html`
      <form @submit=${this.save}>
        <label>
          Country
          <select
            .value=${this.form.f.country.value()}
            @change=${(e: Event) =>
              this.form.f.country.set((e.target as HTMLSelectElement).value)}
          >
            <option value="IT">Italy</option>
            <option value="DE">Germany</option>
            <option value="US">United States</option>
          </select>
        </label>

        <fieldset>
          <legend>Shipping address</legend>
          <mdy-text-field .field=${this.form.f.shipping.city} label="City"></mdy-text-field>
          <mdy-text-field .field=${this.form.f.shipping.zip} label="ZIP"></mdy-text-field>
        </fieldset>

        <fieldset>
          <legend>Items</legend>
          ${map(
            this.form.f.items.rows(),
            (row, i) => html`
              <div class="item-row">
                <mdy-text-field .field=${row.sku} label="SKU #${i + 1}"></mdy-text-field>
                <mdy-number-field .field=${row.qty} label="Qty"></mdy-number-field>
                <button type="button" @click=${() => this.form.f.items.remove(i)}>✕</button>
              </div>
            `,
          )}
          ${this.form.f.items.errors()[0]
            ? html`<p role="alert">${this.form.f.items.errors()[0].message}</p>`
            : null}
          <button type="button" @click=${() => this.form.f.items.push({ sku: "", qty: 1 })}>
            Add item
          </button>
        </fieldset>

        <mdy-text-field
          .field=${this.form.f.coupon}
          label=${this.form.f.coupon.pending() ? "Coupon (checking…)" : "Coupon"}
        ></mdy-text-field>

        <button type="submit" ?disabled=${!this.form.state.canSubmit()}>Place order</button>
        <button type="button" @click=${() => this.form.reset()}>Reset</button>
      </form>
    `;
  }
}
```

## What to notice

- **Ready-made controls with the same engine** — `<mdy-text-field>` and
  `<mdy-number-field>` render label, required marker, `aria-*` wiring and
  the error list from the shared engine, styled by `@modyra/styles` (the
  same theme classes as the Angular renderers).
- **`MdyFormController` tracks signals, not fields** — list every signal
  the template reads (`rows`, `errors`, `pending`, `canSubmit`) and the
  host re-renders exactly when those change.
- **Array rows are typed handles** — `map(rows(), …)` yields per-row
  handle trees that bind to elements via `.field`, like any other field.
- **A bridge to every framework** — these custom elements are real web
  components: drop them into an Angular, React or Vue template when you
  want Modyra's UI without the framework-specific catalog.

## Going further

- [`@modyra/lit` package README](../../packages/lit/README.md) — entry points, control catalog, value models
- [Multi-framework architecture](../guides/multi-framework.md) — the ReactiveController binding
- [Typed forms guide](../guides/typed-forms.md) — the engine API, framework-free
