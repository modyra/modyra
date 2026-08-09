import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { field, group, mdyForm, record } from "@modyra/angular/adapter";
import { MdyFormComponent, MdyNumberComponent, MdyTextComponent } from "@modyra/angular/ui";
import { required as mdyRequired } from "@modyra/core";

/**
 * The arrangement `record()` exists for, in Angular.
 *
 * The table is rendered **by column**: each `ng-container` below draws one cell of every row, so the
 * two controls of a row are created in different places in the template and at different times, and
 * they come and go as rows enter and leave edit mode. None of that decides what the form holds — a
 * row exists because `upsert` declared it, and the verdict at the bottom follows the data.
 */
@Component({
  selector: "app-keyed-rows-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <section class="demo-section">
      <h2>Rows keyed by data</h2>
      <p class="section-lead">
        Sorting, closing an editor and removing a row change nothing a value depends on: the row is
        declared, the controls only claim.
      </p>

      <mdy-form [form]="rows">
      <table class="keyed-rows">
        <thead>
          <tr><th>Key</th><th>Item</th><th>Qty</th><th></th></tr>
        </thead>
        <tbody>
          @for (key of orderedKeys(); track key) {
            <tr [class.editing]="editing().has(key)">
              <td>{{ key }}</td>

              <!-- One column, one cell of each row. It knows the key and the part, and never
                   whether the row exists yet: the handle answers either way, inert until the row is
                   declared. row(key) is the typed spelling; cell(key, part) is the one for a part
                   chosen at runtime. -->
              <td>
                @if (editing().has(key)) {
                  <mdy-control-text [field]="rows.f.lines.row(key).item" label="" />
                } @else {
                  {{ rows.f.lines.row(key).item.value() }}
                }
              </td>

              <td>
                @if (editing().has(key)) {
                  <mdy-control-number [field]="rows.f.lines.row(key).qty" label="" />
                } @else {
                  {{ rows.f.lines.row(key).qty.value() }}
                }
              </td>

              <td class="keyed-rows-actions">
                <button type="button" (click)="toggle(key)">
                  {{ editing().has(key) ? "Done" : "Edit" }}
                </button>
                @if (key.startsWith("tmp:")) {
                  <button type="button" (click)="save(key)">Save</button>
                }
                <button type="button" (click)="remove(key)">Remove</button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="keyed-rows-actions">
        <button type="button" (click)="descending.set(!descending())">
          {{ descending() ? "Sort ascending" : "Sort descending" }}
        </button>
        <button type="button" (click)="add()">Add row</button>
        <button type="button" (click)="closeEveryEditor()">Close every editor</button>
      </div>

      </mdy-form>

      <pre class="keyed-rows-state">rows valid: {{ rows.state.valid() }}
declared: {{ orderedKeys().join(", ") || "(none)" }}
{{ asJson() }}</pre>
    </section>
  `,
})
export class KeyedRowsSectionComponent {
  readonly rows = mdyForm({
    lines: record(
      group({
        item: field("", [mdyRequired()]),
        qty: field<number>(1, [(value) => (Number(value) >= 1 ? [] : ["At least 1"])]),
      }),
    ),
  });

  readonly editing = signal(new Set<string>(["tmp:1"]));
  readonly descending = signal(false);

  constructor() {
    // The rows a server would have sent: its ids, serialised, plus one started here.
    this.rows.f.lines.setAll({
      12: { item: "Espresso", qty: 2 },
      34: { item: "Cornetto", qty: 1 },
      "tmp:1": { item: "", qty: 1 },
    });
  }

  orderedKeys(): readonly string[] {
    const keys = [...this.rows.f.lines.keys()];
    return keys.sort((a, b) => (this.descending() ? b.localeCompare(a) : a.localeCompare(b)));
  }

  closeEveryEditor(): void {
    this.editing.set(new Set());
  }

  toggle(key: string): void {
    const next = new Set(this.editing());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.editing.set(next);
  }

  /** What a save does when the server answers with the real id. */
  save(key: string): void {
    const assigned = String(Math.floor(Math.random() * 900) + 100);
    this.rows.f.lines.rename(key, assigned);
    const next = new Set(this.editing());
    next.delete(key);
    next.add(assigned);
    this.editing.set(next);
  }

  remove(key: string): void {
    this.rows.f.lines.remove(key);
    const next = new Set(this.editing());
    next.delete(key);
    this.editing.set(next);
  }

  add(): void {
    this.rows.f.lines.upsert(`tmp:${Date.now()}`, { item: "", qty: 1 });
  }

  /** Read through the form's own value signal, so the panel follows a cell edit. */
  asJson(): string {
    return JSON.stringify(this.rows.value().lines, null, 2);
  }
}
