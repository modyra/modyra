import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { field, group, mdyForm, record } from "@modyra/angular/adapter";
import { MdyFormComponent, MdyNumberComponent, MdyTextComponent } from "@modyra/angular/ui";
import { required as mdyRequired } from "@modyra/core";

/** Every line's splits must total 100%, and a cost centre may appear once per line. */
const linesBalanced = (lines: Readonly<Record<string, unknown>>): string[] => {
  const failures: string[] = [];
  for (const [key, raw] of Object.entries(lines ?? {})) {
    const line = raw as { splits?: Record<string, { costCenter?: string; percent?: unknown }> };
    const splits = Object.entries(line.splits ?? {});
    const total = splits.reduce((sum, [, s]) => sum + Number(s.percent ?? 0), 0);
    if (total !== 100) failures.push(`line ${key}: splits total ${total}%`);
    const centres = splits.map(([, s]) => s.costCenter).filter(Boolean);
    if (new Set(centres).size !== centres.length) failures.push(`line ${key}: duplicate cost centre`);
  }
  return failures;
};

/** Invoices → lines → cost splits: validity lives in the model, not in the viewport. */
@Component({
  selector: "app-invoices-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <section class="demo-section">
      <h2>Fatture, righe, ripartizioni</h2>
      <p class="demo-scenario">
        Sei in amministrazione. Ogni fattura ha righe di spesa, e ogni riga va ripartita fra centri
        di costo fino a coprire il 100%. La demo mostra che chiudere una riga non la mette a posto:
        una ripartizione incompleta continua a bloccare la fattura anche quando nessuno la guarda.
      </p>
      <mdy-form [form]="form">
        <div class="keyed-rows-actions">
          <button type="button" class="demo-action" (click)="close()"><span>Close the line</span><small>nasconde la riga: la fattura resta invalida al 95%</small></button>
          <button type="button" class="demo-action" (click)="reopen()"><span>Reopen the line</span><small>riapre la riga: l'errore e ancora sulla ripartizione che lo causa</small></button>
          <button type="button" class="demo-action" (click)="fixSplit()"><span>Fix the split</span><small>porta CC-20 dal 35% al 40%: la ripartizione arriva a 100</small></button>
          <button type="button" class="demo-action" (click)="approve()"><span>Approve the line</span><small>blocca la riga in sola lettura: resta validata e inviata</small></button>
          <button type="button" class="demo-action" (click)="submitToServer()"><span>Submit to the server</span><small>il server rifiuta CC-10: l'errore torna sul path della ripartizione</small></button>
        </div>
        @for (invKey of form.f.invoices.keys(); track invKey) {
          <div class="order-box" [attr.data-invoice]="invKey">
            <strong>Fattura {{ invKey }} — {{ form.f.invoices.row(invKey).supplier.value() }}</strong>
            @for (lineKey of form.f.invoices.row(invKey).lines.keys(); track lineKey) {
              @if (collapsed().has(invKey + '.' + lineKey)) {
                <p class="demo-hidden-note">
                  Riga {{ lineKey }} chiusa —
                  {{ form.f.invoices.row(invKey).lines.row(lineKey).splits.keys().length }}
                  {{ form.f.invoices.row(invKey).lines.row(lineKey).splits.keys().length === 1 ? "ripartizione nascosta" : "ripartizioni nascoste" }},
                  la fattura resta bloccata finche non arrivano al 100%
                </p>
              } @else {
                <div class="demo-level">
                  <div class="demo-level-caption">
                    Riga {{ lineKey }} — descrizione e importo
                    @if (approved().includes('invoices.' + invKey + '.lines.' + lineKey)) {
                      <span class="demo-badge">approvata: sola lettura</span>
                    }
                  </div>
                  <div class="grid" [attr.data-line]="invKey + '.' + lineKey">
                    <mdy-control-text [field]="form.f.invoices.row(invKey).lines.row(lineKey).desc" [ariaLabel]="'Description ' + lineKey" />
                    <mdy-control-number [field]="form.f.invoices.row(invKey).lines.row(lineKey).amount" [ariaLabel]="'Amount ' + lineKey" />
                  </div>
                  @for (splitKey of form.f.invoices.row(invKey).lines.row(lineKey).splits.keys(); track splitKey) {
                    <div class="demo-level">
                      <div class="demo-level-caption">Ripartizione {{ splitKey }} — centro di costo e quota</div>
                      <div class="grid" [attr.data-split]="invKey + '.' + lineKey + '.' + splitKey">
                        <mdy-control-text [field]="form.f.invoices.row(invKey).lines.row(lineKey).splits.row(splitKey).costCenter" [ariaLabel]="'Cost centre ' + splitKey" />
                        <mdy-control-number [field]="form.f.invoices.row(invKey).lines.row(lineKey).splits.row(splitKey).percent" [ariaLabel]="'Percent ' + splitKey" />
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
export class InvoicesSectionComponent {
  readonly form = mdyForm({
    invoices: record(group({
      supplier: field("", [mdyRequired()]),
      lines: record(group({
        desc: field(""),
        amount: field<number>(100),
        splits: record(group({ costCenter: field(""), percent: field<number>(0) })),
      }), { validators: [linesBalanced] }),
    })),
  });

  readonly collapsed = signal(new Set<string>());
  readonly approved = signal<readonly string[]>([]);

  constructor() {
    this.form.f.invoices.upsert("INV-1", {
      supplier: "Acme",
      lines: { l1: { desc: "Consulting", amount: 100, splits: { s1: { costCenter: "CC-10", percent: 60 }, s2: { costCenter: "CC-20", percent: 35 } } } },
    });
  }

  close(): void { const next = new Set(this.collapsed()); next.add("INV-1.l1"); this.collapsed.set(next); }
  reopen(): void { const next = new Set(this.collapsed()); next.delete("INV-1.l1"); this.collapsed.set(next); }

  fixSplit(): void {
    this.form.f.invoices.row("INV-1").lines.row("l1").splits.row("s2").percent.set(40);
  }

  private readonly locked = signal(true);

  approve(): void {
    const base = "invoices.INV-1.lines.l1";
    for (const leaf of ["desc", "amount", "splits.s1.costCenter", "splits.s1.percent", "splits.s2.costCenter", "splits.s2.percent"]) {
      this.form.setReadonly(`${base}.${leaf}`, this.locked);
    }
    this.approved.set([...this.approved(), base]);
  }

  submitToServer(): void {
    void this.form.submit(async () => [
      { path: "invoices.INV-1.lines.l1.splits.s1.percent", kind: "server" as const, message: "CC-10 is frozen this quarter" },
    ]);
  }

  /** The state both halves of the panel read — sentences above, JSON behind the details. */
  private state(): {
    readonly valid: boolean;
    readonly lineErrors: Record<string, readonly { readonly message: string }[]>;
    readonly approved: readonly string[];
    readonly splitServerError: readonly string[];
    readonly [key: string]: unknown;
  } {
    const invoices = this.form.f.invoices;
    return {
      invoices: invoices.keys(),
      lines: Object.fromEntries(invoices.keys().map((k) => [k, invoices.row(k).lines.keys()])),
      valid: this.form.state.valid(),
      lineErrors: Object.fromEntries(
        invoices.keys().map((k) => [k, invoices.row(k).lines.errors()] as const).filter(([, e]) => e.length > 0),
      ),
      approved: this.approved(),
      splitServerError: this.form.errorsFor("invoices.INV-1.lines.l1.splits.s1.percent")().map((e) => e.message),
      value: this.form.value().invoices,
    };
  }

  stateJson(): string {
    return JSON.stringify(this.state(), null, 2);
  }

  sentences(): readonly (readonly [string, string])[] {
    const readable = (message: string): string => message
      .replace(/^line (\S+): splits total (\d+)%$/, "Riga $1 — ripartito $2%, manca il resto per arrivare a 100")
      .replace(/^line (\S+): duplicate cost centre$/, "Riga $1 — lo stesso centro di costo compare due volte");
    const s = this.state();
    const rows: (readonly [string, string])[] = [];
    rows.push(s.valid
      ? ["ok", "Fattura pronta: ogni riga e ripartita al 100%"]
      : ["ko", "Fattura bloccata — le ripartizioni non tornano"]);
    for (const [key, errs] of Object.entries(s.lineErrors)) {
      for (const e of errs) rows.push(["ko", `${key}: ${readable(e.message)}`]);
    }
    for (const base of s.approved) {
      rows.push(["", `${base.split(".").slice(-1)[0]} approvata — sola lettura, ma sempre validata e inviata`]);
    }
    for (const message of s.splitServerError) rows.push(["ko", `Il server rifiuta la ripartizione s1: ${message}`]);
    if (this.collapsed().size > 0) rows.push(["", "Una riga e chiusa: il verdetto qui sopra la conta comunque"]);
    return rows;
  }
}
