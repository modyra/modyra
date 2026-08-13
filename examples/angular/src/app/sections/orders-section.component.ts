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
      <h2>Ordini, righe, allocazioni</h2>
      <p class="demo-scenario">
        Sei un operatore logistico. Gestisci ordini che contengono righe di prodotto, e ogni riga va
        coperta da allocazioni di magazzino. La demo mostra che ordinare, filtrare e chiudere pezzi
        di interfaccia non tocca mai i dati: il modello possiede tutto, lo schermo ne mostra una parte.
      </p>
      <mdy-form [form]="form">
        <div class="keyed-rows-actions">
          <button type="button" class="demo-action" (click)="addOrder()"><span>Add order</span><small>crea un ordine con chiave provvisoria tmp:*</small></button>
          <button type="button" class="demo-action" (click)="serverAssigns()"><span>Server assigns code</span><small>il server risponde: la chiave tmp diventa ORD-*, i dati restano</small></button>
          <button type="button" class="demo-action" (click)="addAllocation()"><span>Add allocation</span><small>aggiunge un'allocazione alla prima riga (copre la quantita)</small></button>
          <button type="button" class="demo-action" (click)="removeOrder()"><span>Remove order</span><small>elimina il primo ordine con tutte le righe e allocazioni</small></button>
          <button type="button" class="demo-action" (click)="form.undo()"><span>Undo</span><small>ripristina intero l'ultimo ordine rimosso</small></button>
          <button type="button" class="demo-action" (click)="toggleCollapse()"><span>Collapse first</span><small>nasconde le righe del primo ordine: la validita non cambia</small></button>
          <button type="button" class="demo-action" (click)="filter.set(filter() ? '' : 'ORD')"><span>Filter ORD</span><small>mostra solo gli ordini confermati: i tmp restano nel modello</small></button>
        </div>
        @for (orderKey of visibleOrders(); track orderKey) {
          <div class="order-box" [attr.data-order]="orderKey">
            <strong>
              Ordine {{ orderKey }} — {{ form.f.orders.row(orderKey).customer.value() }}
              @if (orderKey.startsWith("tmp:")) { <span class="demo-badge">provvisorio</span> }
            </strong>
            @if (collapsed().has(orderKey)) {
              <p class="demo-hidden-note">
                {{ form.f.orders.row(orderKey).lines.keys().length }}
                {{ form.f.orders.row(orderKey).lines.keys().length === 1 ? "riga nascosta" : "righe nascoste" }}
                — validita ed errori restano attivi
              </p>
            } @else {
              @for (lineKey of form.f.orders.row(orderKey).lines.keys(); track lineKey) {
                <div class="demo-level">
                  <div class="demo-level-caption">Riga {{ lineKey }} — prodotto e quantita</div>
                  <div class="grid" [attr.data-line]="orderKey + '.' + lineKey">
                    <mdy-control-text [field]="form.f.orders.row(orderKey).lines.row(lineKey).sku" [ariaLabel]="'SKU ' + lineKey" />
                    <mdy-control-number [field]="form.f.orders.row(orderKey).lines.row(lineKey).qty" [ariaLabel]="'Qty ' + lineKey" />
                  </div>
                  @for (allocKey of form.f.orders.row(orderKey).lines.row(lineKey).allocs.keys(); track allocKey) {
                    <div class="demo-level">
                      <div class="demo-level-caption">Allocazione {{ allocKey }} — lotto e quantita coperta</div>
                      <div class="grid" [attr.data-alloc]="orderKey + '.' + lineKey + '.' + allocKey">
                        <mdy-control-text [field]="form.f.orders.row(orderKey).lines.row(lineKey).allocs.row(allocKey).lot" [ariaLabel]="'Lot ' + allocKey" />
                        <mdy-control-number [field]="form.f.orders.row(orderKey).lines.row(lineKey).allocs.row(allocKey).qty" [ariaLabel]="'Allocated ' + allocKey" />
                      </div>
                    </div>
                  }
                </div>
              }
            }
          </div>
        }
      </mdy-form>
      <ul class="demo-verdict">
        @for (row of sentences(); track $index) { <li [class]="row[0]">{{ row[1] }}</li> }
      </ul>
      <details>
        <summary>dati grezzi (JSON)</summary>
        <pre class="demo-state">{{ stateJson() }}</pre>
      </details>
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

  /** The state both halves of the panel read — sentences above, JSON behind the details. */
  private state(): {
    readonly orders: readonly string[];
    readonly valid: boolean;
    readonly pending: boolean;
    readonly lineErrors: Record<string, readonly { readonly message: string }[]>;
    readonly canUndo: boolean;
    readonly [key: string]: unknown;
  } {
    const orders = this.form.f.orders;
    return {
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
    };
  }

  stateJson(): string {
    return JSON.stringify(this.state(), null, 2);
  }

  sentences(): readonly (readonly [string, string])[] {
    const s = this.state();
    const rows: (readonly [string, string])[] = [];
    rows.push(s.valid
      ? ["ok", "Tutti i controlli passano: ogni riga e coperta dalle sue allocazioni"]
      : ["ko", "L'ordine non e completo — vedi sotto"]);
    if (s.pending) rows.push(["", "… verifica disponibilita lotto in corso"]);
    for (const key of s.orders) {
      rows.push(["", key.startsWith("tmp:")
        ? `Ordine ${key} — provvisorio, in attesa del codice server`
        : `Ordine ${key} — confermato`]);
    }
    for (const errs of Object.values(s.lineErrors)) {
      for (const e of errs) {
        rows.push(["ko", e.message.replace(/^line (\S+): allocated (\d+) of (\d+)$/, "Riga $1 — allocati $2 su $3")]);
      }
    }
    if (s.canUndo) rows.push(["", "Undo disponibile: l'ultima operazione e reversibile, struttura inclusa"]);
    return rows;
  }
}
