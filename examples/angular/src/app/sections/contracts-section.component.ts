import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { field, group, mdyForm, record } from "@modyra/angular/adapter";
import { MdyFormComponent, MdyNumberComponent, MdyTextComponent } from "@modyra/angular/ui";
import { required as mdyRequired } from "@modyra/core";

/**
 * A line's bands must tile its quantity axis: each band's minimum below its maximum, no two bands
 * covering the same quantity, and no quantity left uncovered between the lowest and the highest.
 */
const bandsTile = (bands: Readonly<Record<string, unknown>>): string[] => {
  const failures: string[] = [];
  const rows = Object.entries(bands ?? {}).map(([key, raw]) => {
    const b = raw as { minQty?: unknown; maxQty?: unknown };
    return { key, min: Number(b.minQty ?? 0), max: Number(b.maxQty ?? 0) };
  });
  for (const b of rows) {
    if (b.min >= b.max) failures.push(`band ${b.key}: min ${b.min} is not below max ${b.max}`);
  }
  const ordered = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;
    if (current.min < previous.max) failures.push(`bands ${previous.key} and ${current.key} overlap at ${current.min}`);
    else if (current.min > previous.max) failures.push(`bands ${previous.key} and ${current.key} leave ${previous.max}-${current.min} uncovered`);
  }
  return failures;
};

/** Across a contract's lines: a price that never rises with quantity. */
const linesCoherent = (lines: Readonly<Record<string, unknown>>): string[] => {
  const failures: string[] = [];
  for (const [key, raw] of Object.entries(lines ?? {})) {
    const line = raw as { bands?: Record<string, { minQty?: unknown; price?: unknown }> };
    const bands = Object.entries(line.bands ?? {})
      .map(([bandKey, b]) => ({ key: bandKey, min: Number(b.minQty ?? 0), price: Number(b.price ?? 0) }))
      .sort((a, b) => a.min - b.min);
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i]!.price > bands[i - 1]!.price) {
        failures.push(`line ${key}: band ${bands[i]!.key} costs more per unit than ${bands[i - 1]!.key}`);
      }
    }
  }
  return failures;
};

/**
 * Contracts → lines → price bands: a rule about a whole collection is checked where the collection
 * lives, so a collapsed band still gates the contract and sorting for reading never renames a band.
 */
@Component({
  selector: "app-contracts-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <section class="demo-section">
      <h2>Contratti, righe, fasce di prezzo</h2>
      <p class="demo-scenario">
        Sei al commerciale. Un contratto quadro fissa, per ogni prodotto, gli scaglioni di prezzo: da
        1 a 100 pezzi un prezzo, da 100 a 500 un altro. La demo mostra che gli scaglioni devono
        coprire tutte le quantita senza buchi ne sovrapposizioni, e che l'errore nomina le due fasce
        in conflitto anche quando sono chiuse.
      </p>
      <mdy-form [form]="form">
        <div class="keyed-rows-actions">
          <button type="button" class="demo-action" (click)="moveThreshold()"><span>Move the threshold</span><small>porta la fascia b2 a partire da 80: si sovrappone a b1</small></button>
          <button type="button" class="demo-action" (click)="leaveGap()"><span>Leave a gap</span><small>porta la fascia b2 a partire da 120: 100-120 resta scoperto</small></button>
          <button type="button" class="demo-action" (click)="restore()"><span>Restore the ladder</span><small>riporta b2 a partire da 100: gli scaglioni tornano contigui</small></button>
          <button type="button" class="demo-action" (click)="addBand()"><span>Add a band</span><small>aggiunge lo scaglione oltre i 500 pezzi</small></button>
          <button type="button" class="demo-action" (click)="raiseTopPrice()"><span>Raise the top price</span><small>porta l'ultimo scaglione sopra il precedente: il prezzo risale</small></button>
          <button type="button" class="demo-action" (click)="descending.set(!descending())"><span>Sort bands descending</span><small>inverte solo l'ordine di lettura: le chiavi non cambiano</small></button>
          <button type="button" class="demo-action" (click)="collapsed.set(!collapsed())"><span>Collapse the bands</span><small>chiude le fasce: le regole di copertura restano attive</small></button>
          <button type="button" class="demo-action" (click)="sendForApproval()"><span>Send for approval</span><small>il server rifiuta lo sconto oltre la soglia sulla fascia b2</small></button>
        </div>
        @for (contractKey of form.f.contracts.keys(); track contractKey) {
          <div class="order-box" [attr.data-contract]="contractKey">
            <strong>
              Contratto {{ contractKey }} — {{ form.f.contracts.row(contractKey).customer.value() }}
              <span class="demo-badge">{{ form.f.contracts.row(contractKey).currency.value() }}</span>
            </strong>
            @for (lineKey of form.f.contracts.row(contractKey).lines.keys(); track lineKey) {
              <div class="demo-level">
                <div class="demo-level-caption">Riga {{ lineKey }} — prodotto a listino</div>
                <div class="grid" [attr.data-line]="contractKey + '.' + lineKey">
                  <mdy-control-text [field]="form.f.contracts.row(contractKey).lines.row(lineKey).sku" [ariaLabel]="'SKU ' + lineKey" />
                </div>
                @if (collapsed()) {
                  <p class="demo-hidden-note">
                    {{ form.f.contracts.row(contractKey).lines.row(lineKey).bands.keys().length }}
                    {{ form.f.contracts.row(contractKey).lines.row(lineKey).bands.keys().length === 1 ? "fascia nascosta" : "fasce nascoste" }}
                    — le regole di copertura restano attive
                  </p>
                } @else {
                  @for (bandKey of readingOrder(); track bandKey) {
                    <div class="demo-level">
                      <div class="demo-level-caption">Fascia {{ bandKey }} — da quanti pezzi, fino a quanti, a che prezzo</div>
                      <div class="grid grid--three" [attr.data-band]="contractKey + '.' + lineKey + '.' + bandKey">
                        <mdy-control-number [field]="form.f.contracts.row(contractKey).lines.row(lineKey).bands.row(bandKey).minQty" [ariaLabel]="'Min ' + bandKey" />
                        <mdy-control-number [field]="form.f.contracts.row(contractKey).lines.row(lineKey).bands.row(bandKey).maxQty" [ariaLabel]="'Max ' + bandKey" />
                        <mdy-control-number [field]="form.f.contracts.row(contractKey).lines.row(lineKey).bands.row(bandKey).price" [ariaLabel]="'Price ' + bandKey" />
                      </div>
                    </div>
                  }
                }
              </div>
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
export class ContractsSectionComponent {
  readonly form = mdyForm({
    contracts: record(group({
      customer: field("", [mdyRequired()]),
      currency: field("EUR"),
      lines: record(group({
        sku: field(""),
        bands: record(group({ minQty: field<number>(0), maxQty: field<number>(0), price: field<number>(0) }), { validators: [bandsTile] }),
      }), { validators: [linesCoherent] }),
    })),
  });

  readonly descending = signal(false);
  readonly collapsed = signal(false);

  constructor() {
    this.form.f.contracts.upsert("C-1", {
      customer: "Acme",
      currency: "EUR",
      lines: { l1: { sku: "SKU-1", bands: {
        b1: { minQty: 1, maxQty: 100, price: 10 },
        b2: { minQty: 100, maxQty: 500, price: 8 },
      } } },
    });
  }

  private bands() {
    return this.form.f.contracts.row("C-1").lines.row("l1").bands;
  }

  /** Reading order only: the model's keys are identity, and sorting must not touch them. */
  readingOrder(): readonly string[] {
    const bands = this.bands();
    const byMin = [...bands.keys()].sort((a, b) =>
      Number(bands.row(a).minQty.value()) - Number(bands.row(b).minQty.value()));
    return this.descending() ? byMin.reverse() : byMin;
  }

  moveThreshold(): void { this.bands().row("b2").minQty.set(80); }
  leaveGap(): void { this.bands().row("b2").minQty.set(120); }
  restore(): void { this.bands().row("b2").minQty.set(100); }

  addBand(): void {
    const bands = this.bands();
    bands.upsert(`b${bands.keys().length + 1}`, { minQty: 500, maxQty: 2000, price: 7 });
  }

  raiseTopPrice(): void {
    const bands = this.bands();
    const last = bands.keys()[bands.keys().length - 1];
    if (last !== undefined) bands.row(last).price.set(99);
  }

  sendForApproval(): void {
    void this.form.submit(async () => [
      { path: "contracts.C-1.lines.l1.bands.b2.price", kind: "server" as const, message: "Discount above 20% needs approval" },
    ]);
  }

  /** The state both halves of the panel read — sentences above, JSON behind the details. */
  private state(): {
    readonly valid: boolean;
    readonly bands: readonly string[];
    readonly readingOrder: readonly string[];
    readonly bandErrors: readonly string[];
    readonly lineErrors: Record<string, readonly { readonly message: string }[]>;
    readonly serverErrors: readonly string[];
    readonly [key: string]: unknown;
  } {
    const contracts = this.form.f.contracts;
    return {
      contracts: contracts.keys(),
      lines: Object.fromEntries(contracts.keys().map((k) => [k, contracts.row(k).lines.keys()])),
      bands: this.bands().keys(),
      readingOrder: this.readingOrder(),
      valid: this.form.state.valid(),
      bandErrors: this.form.errorsFor("contracts.C-1.lines.l1.bands")().map((e) => e.message),
      lineErrors: Object.fromEntries(
        contracts.keys().map((k) => [k, contracts.row(k).lines.errors()] as const).filter(([, e]) => e.length > 0),
      ),
      serverErrors: this.form.errorsFor("contracts.C-1.lines.l1.bands.b2.price")().map((e) => e.message),
      value: this.form.value().contracts,
    };
  }

  stateJson(): string {
    return JSON.stringify(this.state(), null, 2);
  }

  sentences(): readonly (readonly [string, string])[] {
    const readable = (message: string): string => message
      .replace(/^bands (\S+) and (\S+) overlap at (\d+)$/, "Le fasce $1 e $2 si sovrappongono a partire da $3 pezzi")
      .replace(/^bands (\S+) and (\S+) leave (\d+)-(\d+) uncovered$/, "Fra $1 e $2 le quantita da $3 a $4 non hanno prezzo")
      .replace(/^band (\S+): min (\d+) is not below max (\d+)$/, "La fascia $1 parte da $2 e finisce a $3: non copre nulla")
      .replace(/^line (\S+): band (\S+) costs more per unit than (\S+)$/, "Riga $1 — la fascia $2 costa piu di $3: il prezzo risale col volume");
    const s = this.state();
    const rows: (readonly [string, string])[] = [];
    rows.push(s.valid
      ? ["ok", "Listino coerente: gli scaglioni coprono tutte le quantita e il prezzo scende col volume"]
      : ["ko", "Listino non applicabile — vedi sotto"]);
    for (const message of s.bandErrors) rows.push(["ko", readable(message)]);
    for (const errs of Object.values(s.lineErrors)) {
      for (const e of errs) rows.push(["ko", readable(e.message)]);
    }
    for (const message of s.serverErrors) rows.push(["ko", `Il server blocca la fascia b2: ${message}`]);
    rows.push(["", `Ordine di lettura: ${s.readingOrder.join(" → ")} — chiavi nel modello: ${s.bands.join(", ")}`]);
    return rows;
  }
}
