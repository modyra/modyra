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
      <h2>Invoices — splits that must balance</h2>
      <mdy-form [form]="form">
        <div class="keyed-rows-actions">
          <button type="button" (click)="close()">Close the line</button>
          <button type="button" (click)="reopen()">Reopen the line</button>
          <button type="button" (click)="fixSplit()">Fix the split</button>
          <button type="button" (click)="approve()">Approve the line</button>
          <button type="button" (click)="submitToServer()">Submit to the server</button>
        </div>
        @for (invKey of form.f.invoices.keys(); track invKey) {
          <div class="order-box" [attr.data-invoice]="invKey">
            <strong>{{ invKey }} — {{ form.f.invoices.row(invKey).supplier.value() }}</strong>
            @for (lineKey of form.f.invoices.row(invKey).lines.keys(); track lineKey) {
              @if (!collapsed().has(invKey + '.' + lineKey)) {
                <div class="grid" [attr.data-line]="invKey + '.' + lineKey">
                  <mdy-control-text [field]="form.f.invoices.row(invKey).lines.row(lineKey).desc" [ariaLabel]="'Description ' + lineKey" />
                  <mdy-control-number [field]="form.f.invoices.row(invKey).lines.row(lineKey).amount" [ariaLabel]="'Amount ' + lineKey" />
                </div>
                @for (splitKey of form.f.invoices.row(invKey).lines.row(lineKey).splits.keys(); track splitKey) {
                  <div class="grid" [attr.data-split]="invKey + '.' + lineKey + '.' + splitKey">
                    <mdy-control-text [field]="form.f.invoices.row(invKey).lines.row(lineKey).splits.row(splitKey).costCenter" [ariaLabel]="'Cost centre ' + splitKey" />
                    <mdy-control-number [field]="form.f.invoices.row(invKey).lines.row(lineKey).splits.row(splitKey).percent" [ariaLabel]="'Percent ' + splitKey" />
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

  stateJson(): string {
    const invoices = this.form.f.invoices;
    return JSON.stringify({
      invoices: invoices.keys(),
      lines: Object.fromEntries(invoices.keys().map((k) => [k, invoices.row(k).lines.keys()])),
      valid: this.form.state.valid(),
      lineErrors: Object.fromEntries(
        invoices.keys().map((k) => [k, invoices.row(k).lines.errors()] as const).filter(([, e]) => e.length > 0),
      ),
      approved: this.approved(),
      splitServerError: this.form.errorsFor("invoices.INV-1.lines.l1.splits.s1.percent")().map((e) => e.message),
      value: this.form.value().invoices,
    }, null, 2);
  }
}
