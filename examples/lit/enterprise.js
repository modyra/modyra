/**
 * Orders → lines → allocations in Lit: three keyed levels driven through handles.
 * The interface renders portions of the structure; the model owns it whole.
 */
import { html, LitElement, nothing } from "lit";
import { createLitForm, field, group, record, required, MdyFormController } from "@modyra/lit/adapter";
import { serverValidator } from "@modyra/core";
import { defineMdyElements } from "@modyra/lit";

defineMdyElements();

const lotAvailable = async (value) => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value === "L-DEAD" ? "Lot unavailable" : null;
};

const linesCovered = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const allocated = Object.values(line.allocs ?? {}).reduce((sum, a) => sum + Number(a.qty ?? 0), 0);
    if (allocated !== Number(line.qty ?? 0)) failures.push(`line ${key}: allocated ${allocated} of ${line.qty}`);
  }
  return failures;
};

class NestedOrders extends LitElement {
  static properties = { filter: { state: true }, collapsed: { state: true } };

  form = createLitForm({
    orders: record(group({
      customer: field("", [required()]),
      lines: record(group({
        sku: field("", [required()]),
        qty: field(1),
        allocs: record(group({
          warehouse: field(""),
          lot: field("", [], serverValidator(lotAvailable, { debounceMs: 50 })),
          qty: field(0),
        })),
      }), { validators: [linesCovered] }),
    })),
  }, { history: true });

  constructor() {
    super();
    this.filter = "";
    this.collapsed = new Set();
    this.form.f.orders.upsert("tmp:1", {
      customer: "Acme",
      lines: { l1: { sku: "SKU-1", qty: 3, allocs: { a1: { warehouse: "W1", lot: "L-7", qty: 2 } } } },
    });
    this._tracker = new MdyFormController(this, [
      this.form.f.orders.keys, this.form.value, this.form.state.valid, this.form.state.pending,
      this.form.canUndo, this.form.canRedo,
    ]);
  }

  createRenderRoot() { return this; }

  #first() { return this.form.f.orders.keys()[0]; }

  render() {
    const orders = this.form.f.orders;
    return html`
      <h1>Orders — three keyed levels</h1>
      <div class="bar">
        <button @click=${() => { orders.upsert(`tmp:${orders.keys().length + 1}`, { customer: "New Co", lines: {} }); }}>Add order</button>
        <button @click=${() => { const p = orders.keys().find((k) => k.startsWith("tmp:")); if (p) orders.rename(p, `ORD-${100 + orders.keys().length}`); }}>Server assigns code</button>
        <button @click=${() => { const k = this.#first(); if (!k) return; const lines = orders.row(k).lines; const lk = lines.keys()[0]; if (!lk) return; const allocs = lines.row(lk).allocs; allocs.upsert(`a${allocs.keys().length + 1}`, { warehouse: "W2", lot: "L-9", qty: 1 }); }}>Add allocation</button>
        <button @click=${() => { const k = this.#first(); if (k) orders.remove(k); }}>Remove order</button>
        <button @click=${() => { this.form.undo(); }}>Undo</button>
        <button @click=${() => { const k = this.#first(); if (!k) return; const next = new Set(this.collapsed); next.has(k) ? next.delete(k) : next.add(k); this.collapsed = next; }}>Collapse first</button>
        <button @click=${() => { this.filter = this.filter ? "" : "ORD"; }}>Filter ORD</button>
      </div>
      ${orders.keys().filter((k) => !this.filter || k.includes(this.filter)).map((orderKey) => {
        const order = orders.row(orderKey);
        return html`<div class="order-box" data-order=${orderKey}>
          <strong>${orderKey} — ${order.customer.value()}</strong>
          ${this.collapsed.has(orderKey) ? nothing : order.lines.keys().map((lineKey) => {
            const line = order.lines.row(lineKey);
            return html`<div class="grid" data-line=${`${orderKey}.${lineKey}`}>
                <mdy-text-field aria-label=${`SKU ${lineKey}`} .field=${line.sku}></mdy-text-field>
                <mdy-number-field aria-label=${`Qty ${lineKey}`} .field=${line.qty}></mdy-number-field>
              </div>
              ${line.allocs.keys().map((allocKey) => html`<div class="grid" data-alloc=${`${orderKey}.${lineKey}.${allocKey}`}>
                <mdy-text-field aria-label=${`Lot ${allocKey}`} .field=${line.allocs.row(allocKey).lot}></mdy-text-field>
                <mdy-number-field aria-label=${`Allocated ${allocKey}`} .field=${line.allocs.row(allocKey).qty}></mdy-number-field>
              </div>`)}`;
          })}
        </div>`;
      })}
      <pre class="demo-state">${JSON.stringify({
        orders: this.form.f.orders.keys(),
        lines: Object.fromEntries(this.form.f.orders.keys().map((k) => [k, this.form.f.orders.row(k).lines.keys()])),
        valid: this.form.state.valid(),
        pending: this.form.state.pending(),
        lineErrors: Object.fromEntries(this.form.f.orders.keys().map((k) => [k, this.form.f.orders.row(k).lines.errors()]).filter(([, e]) => e.length > 0)),
        canUndo: this.form.canUndo(),
        canRedo: this.form.canRedo(),
        value: this.form.getValue().orders,
      }, null, 2)}</pre>`;
  }
}
customElements.define("nested-orders", NestedOrders);
