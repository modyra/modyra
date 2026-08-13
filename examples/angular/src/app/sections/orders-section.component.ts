import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { field, group, mdyForm, record } from "@modyra/angular/adapter";
import { MdyFormComponent, MdyNumberComponent, MdyTextComponent } from "@modyra/angular/ui";
import { required as mdyRequired, serverValidator } from "@modyra/core";

/** The lot check a server would run: L-DEAD is never available, everything else takes a beat. */
const lotAvailable = async (value: string): Promise<string | null> => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value === "L-DEAD" ? "Lot unavailable" : null;
};

/** Every line's allocations must cover its quantity — checked on the collection that owns the lines. */
const linesCovered = (lines: Readonly<Record<string, unknown>>): string[] => {
  const failures: string[] = [];
  for (const [key, raw] of Object.entries(lines ?? {})) {
    const line = raw as { qty?: unknown; allocs?: Record<string, { qty?: unknown }> };
    const allocated = Object.values(line.allocs ?? {}).reduce((sum, a) => sum + Number(a.qty ?? 0), 0);
    if (allocated !== Number(line.qty ?? 0)) failures.push(`line ${key}: allocated ${allocated} of ${line.qty}`);
  }
  return failures;
};

/**
 * Orders → lines → allocations: three keyed levels. The interface renders portions of the
 * structure; the model owns identity, data, validity and lifecycle whole.
 */
@Component({
  selector: "app-orders-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <section class="demo-section">
      <h2>Orders — three keyed levels</h2>
      <mdy-form [form]="form">
        <div class="keyed-rows-actions">
          <button type="button" (click)="addOrder()">Add order</button>
          <button type="button" (click)="serverAssigns()">Server assigns code</button>
          <button type="button" (click)="addAllocation()">Add allocation</button>
          <button type="button" (click)="removeOrder()">Remove order</button>
          <button type="button" (click)="form.undo()">Undo</button>
          <button type="button" (click)="toggleCollapse()">Collapse first</button>
          <button type="button" (click)="filter.set(filter() ? '' : 'ORD')">Filter ORD</button>
        </div>
        @for (orderKey of visibleOrders(); track orderKey) {
          <div class="order-box" [attr.data-order]="orderKey">
            <strong>{{ orderKey }} — {{ form.f.orders.row(orderKey).customer.value() }}</strong>
            @if (!collapsed().has(orderKey)) {
              @for (lineKey of form.f.orders.row(orderKey).lines.keys(); track lineKey) {
                <div class="grid" [attr.data-line]="orderKey + '.' + lineKey">
                  <mdy-control-text [field]="form.f.orders.row(orderKey).lines.row(lineKey).sku" [ariaLabel]="'SKU ' + lineKey" />
                  <mdy-control-number [field]="form.f.orders.row(orderKey).lines.row(lineKey).qty" [ariaLabel]="'Qty ' + lineKey" />
                </div>
                @for (allocKey of form.f.orders.row(orderKey).lines.row(lineKey).allocs.keys(); track allocKey) {
                  <div class="grid" [attr.data-alloc]="orderKey + '.' + lineKey + '.' + allocKey">
                    <mdy-control-text [field]="form.f.orders.row(orderKey).lines.row(lineKey).allocs.row(allocKey).lot" [ariaLabel]="'Lot ' + allocKey" />
                    <mdy-control-number [field]="form.f.orders.row(orderKey).lines.row(lineKey).allocs.row(allocKey).qty" [ariaLabel]="'Allocated ' + allocKey" />
                  </div>
                }
              }
            }
          </div>
        }
      </mdy-form>
      <pre class="demo-state">{{ stateJson() }}</pre>
    </section>
  `,
})
export class OrdersSectionComponent {
  readonly form = mdyForm({
    orders: record(group({
      customer: field("", [mdyRequired()]),
      lines: record(group({
        sku: field("", [mdyRequired()]),
        qty: field<number>(1),
        allocs: record(group({
          warehouse: field(""),
          lot: field("", [], serverValidator(lotAvailable, { debounceMs: 50 })),
          qty: field<number>(0),
        })),
      }), { validators: [linesCovered] }),
    })),
  }, { history: true });

  readonly filter = signal("");
  readonly collapsed = signal(new Set<string>());

  constructor() {
    this.form.f.orders.upsert("tmp:1", {
      customer: "Acme",
      lines: { l1: { sku: "SKU-1", qty: 3, allocs: { a1: { warehouse: "W1", lot: "L-7", qty: 2 } } } },
    });
  }

  visibleOrders(): readonly string[] {
    const f = this.filter();
    return this.form.f.orders.keys().filter((k) => !f || k.includes(f));
  }

  addOrder(): void {
    this.form.f.orders.upsert(`tmp:${this.form.f.orders.keys().length + 1}`, { customer: "New Co", lines: {} });
  }

  serverAssigns(): void {
    const provisional = this.form.f.orders.keys().find((k) => k.startsWith("tmp:"));
    if (provisional) this.form.f.orders.rename(provisional, `ORD-${100 + this.form.f.orders.keys().length}`);
  }

  addAllocation(): void {
    const key = this.form.f.orders.keys()[0];
    if (key === undefined) return;
    const lines = this.form.f.orders.row(key).lines;
    const lineKey = lines.keys()[0];
    if (lineKey === undefined) return;
    const allocs = lines.row(lineKey).allocs;
    allocs.upsert(`a${allocs.keys().length + 1}`, { warehouse: "W2", lot: "L-9", qty: 1 });
  }

  removeOrder(): void {
    const key = this.form.f.orders.keys()[0];
    if (key !== undefined) this.form.f.orders.remove(key);
  }

  toggleCollapse(): void {
    const key = this.form.f.orders.keys()[0];
    if (key === undefined) return;
    const next = new Set(this.collapsed());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.collapsed.set(next);
  }

  stateJson(): string {
    const orders = this.form.f.orders;
    return JSON.stringify({
      orders: orders.keys(),
      lines: Object.fromEntries(orders.keys().map((k) => [k, orders.row(k).lines.keys()])),
      valid: this.form.state.valid(),
      pending: this.form.state.pending(),
      lineErrors: Object.fromEntries(
        orders.keys().map((k) => [k, orders.row(k).lines.errors()] as const).filter(([, e]) => e.length > 0),
      ),
      canUndo: this.form.canUndo(),
      canRedo: this.form.canRedo(),
      value: this.form.value().orders,
    }, null, 2);
  }
}
