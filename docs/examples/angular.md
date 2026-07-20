# Angular — complete checkout example

The same scenario as the [README](../../README.md#1-checkout-nested-groups-repeatable-line-items-a-coupon-checked-server-side)
implemented end-to-end in Angular: nested groups, a typed array of line
items rendered with `@for`, a coupon validated server-side (re-checked when
the country changes, cancelled while typing), submit with server errors,
and a draft that survives page refreshes.

```bash
npm install @modyra/angular @modyra/styles
```

```json
// angular.json → styles
"styles": ["@modyra/styles/default.css", "src/styles.scss"]
```

## The component

```ts
import { Component } from "@angular/core";
import { array, field, group, mdyForm } from "@modyra/angular/adapter";
import {
  MdyFormComponent,
  MdyNumberComponent,
  MdySelectComponent,
  MdyTextComponent,
} from "@modyra/angular/ui";
import type { MdySelectOption } from "@modyra/angular/ui";
import {
  crossField, min, pattern, required, serverValidator,
} from "@modyra/core";
import { OrderApi } from "./order-api";

@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent, MdySelectComponent],
  template: `
    <mdy-form [form]="form" [action]="save">
      <mdy-control-select
        [field]="form.f.country"
        label="Country"
        [options]="countries"
      />

      <fieldset>
        <legend>Shipping address</legend>
        <mdy-control-text [field]="form.f.shipping.city" label="City" />
        <mdy-control-text [field]="form.f.shipping.zip" label="ZIP" />
      </fieldset>

      <fieldset>
        <legend>Items</legend>
        <!-- rows() is a signal: @for re-renders on push/insert/remove/move -->
        @for (row of form.f.items.rows(); track $index) {
          <div class="item-row">
            <mdy-control-text [field]="row.sku" [label]="'SKU #' + ($index + 1)" />
            <mdy-control-number [field]="row.qty" label="Qty" />
            <button type="button" (click)="form.f.items.remove($index)">✕</button>
          </div>
        }
        <!-- array-level validators (e.g. "at least one item") surface here -->
        @if (form.f.items.errors().length > 0) {
          <p class="mdy-error">{{ form.f.items.errors()[0].message }}</p>
        }
        <button type="button" (click)="addItem()">Add item</button>
      </fieldset>

      <!-- pending() is true while the coupon is being checked server-side -->
      <mdy-control-text
        [field]="form.f.coupon"
        [label]="form.f.coupon.pending() ? 'Coupon (checking…)' : 'Coupon'"
      />

      <button type="submit" [disabled]="!form.state.canSubmit()">Place order</button>
      <button type="button" (click)="form.reset()">Reset</button>
    </mdy-form>
  `,
})
export class CheckoutComponent {
  readonly countries: readonly MdySelectOption[] = [
    { value: "IT", label: "Italy" },
    { value: "DE", label: "Germany" },
    { value: "US", label: "United States" },
  ];

  readonly form = mdyForm({
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

  addItem(): void {
    this.form.f.items.push({ sku: "", qty: 1 });
  }

  // Runs only while the form is valid; `order` is the fully typed value:
  // { country: string; shipping: { city: string; zip: string };
  //   items: { sku: string; qty: number }[]; coupon: string }
  save = async (order: Record<string, unknown>) => {
    const res = await OrderApi.create(order);
    if (!res.ok) {
      // Returned errors land on the matching field (path: null → the form)
      return res.errors.map(e => ({ path: e.field, kind: "server", message: e.message }));
    }
  };
}
```

## What to notice

- **Compile-checked paths everywhere** — `form.f.items.rows()[0].sku` and
  `form.f.shipping.zip` are typed handles; a typo is a build error, not a
  runtime `undefined`.
- **Array rows are just handles** — `rows()` is a signal of typed row
  handle trees, so `@for` renders per-row controls with the same
  `[field]` binding as any other field. `push`/`insert`/`remove`/`move`
  rebuild the structure; touched/dirty/errors of affected rows reset on
  structural changes (documented v1 semantics).
- **The coupon takes care of itself** — typing debounces, a country flip
  re-validates (`dependsOn`), a stale HTTP call is aborted via `ctx.signal`,
  and `pending()` feeds the label spinner. `state.canSubmit()` is false
  while any of this is in flight.
- **The draft is automatic** — refresh the page mid-checkout and
  everything but the coupon is back. Drafts are versioned, TTL'd and
  quota-safe (see the [draft security note](../guides/typed-forms.md#draft-autosave)).

## Going further

- [Typed forms guide](../guides/typed-forms.md) — handles, field arrays, async validation, drafts, wizard
- [UI toolkit](../guides/ui-toolkit.md) — the full renderer catalog (select with search, datepicker, file…)
- [Usage modes](../guides/usage-modes.md) — prefer template-only forms? declarative mode
- [Reactive Forms interop](../guides/interop.md) — embed `mdyCva` controls in existing RF forms
