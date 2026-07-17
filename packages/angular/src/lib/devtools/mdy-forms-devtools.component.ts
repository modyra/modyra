import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  Signal,
  signal,
} from "@angular/core";
import { mdyFormSerialize } from "@modyra/core/serialize";
import { MdyFieldHandle, MdyTypedFormLike } from "../core/typed-form";

interface DevtoolsFieldRow {
  readonly path: string;
  readonly value: string;
  readonly valid: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly errors: readonly string[];
}

/**
 * Field paths that look sensitive are masked by default — the devtools
 * must never become the easiest way to shoulder-surf a password.
 */
const SENSITIVE_PATH = /password|passwd|secret|token|card|cvv|ssn|iban/i;

const MASK = "•••";

/**
 * Live inspector for a form model — the universal "why is my form
 * invalid?" debugging pain, answered in one panel.
 *
 * ```html
 * @if (isDevMode) {
 *   <mdy-forms-devtools [form]="form" [fields]="[form.f.email, form.f.address.city]" />
 * }
 * ```
 *
 * Shows the live value (JSON, `File`s serialized), the form state signals
 * (valid/pending/submitting/submitCount/canSubmit), the last submit errors
 * and a per-field row (value, valid/touched/dirty/pending, error messages
 * with their origin) for every handle passed in `[fields]`. Values of
 * sensitive-looking fields (password, token, card…) are masked; add more
 * paths via `[maskFields]`. Render it behind `isDevMode()` — it ships no
 * providers, and it is only bundled when your code imports it (standard
 * tree shaking: unused imports are dropped by the production build).
 */
@Component({
  selector: "mdy-forms-devtools",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-devtools" },
  styles: `
    :host { display: block; font: 11px/1.5 ui-monospace, monospace;
      border: 1px solid currentColor; border-radius: 6px; opacity: 0.9; }
    .mdy-devtools__bar { display: flex; gap: 0.75rem; padding: 0.4rem 0.6rem;
      cursor: pointer; user-select: none; flex-wrap: wrap; }
    .mdy-devtools__bar b { font-weight: 700; }
    .mdy-devtools__bad { color: #d33; }
    .mdy-devtools__ok { color: #292; }
    .mdy-devtools__body { padding: 0.4rem 0.6rem; border-top: 1px dashed currentColor; }
    .mdy-devtools__filters { display: flex; gap: 0.75rem; align-items: center;
      margin-bottom: 0.35rem; }
    .mdy-devtools__filters input[type="text"] { font: inherit; padding: 0.1rem 0.3rem;
      border: 1px solid currentColor; border-radius: 4px; background: transparent;
      color: inherit; width: 10rem; }
    .mdy-devtools__path { cursor: copy; text-decoration: underline dotted; }
    table { border-collapse: collapse; width: 100%; }
    td, th { text-align: left; padding: 0.1rem 0.5rem 0.1rem 0; vertical-align: top; }
    pre { margin: 0.25rem 0; white-space: pre-wrap; word-break: break-all; }
  `,
  template: `
    <div class="mdy-devtools__bar" (click)="open.set(!open())">
      <b>mdy-forms devtools</b>
      <span [class]="state().valid ? 'mdy-devtools__ok' : 'mdy-devtools__bad'">
        valid: {{ state().valid }}
      </span>
      <span>pending: {{ state().pending }}</span>
      <span>submitting: {{ state().submitting }}</span>
      <span>submits: {{ state().submitCount }}</span>
      <span>canSubmit: {{ state().canSubmit }}</span>
      <span>{{ open() ? "▾" : "▸" }}</span>
    </div>
    @if (open()) {
      <div class="mdy-devtools__body">
        @if (rows().length > 0) {
          <div class="mdy-devtools__filters">
            <input
              type="text"
              placeholder="filter fields…"
              aria-label="Filter fields by name"
              [value]="nameFilter()"
              (input)="nameFilter.set($any($event.target).value)"
            />
            <label>
              <input
                type="checkbox"
                [checked]="onlyInvalid()"
                (change)="onlyInvalid.set($any($event.target).checked)"
              />
              invalid
            </label>
            <label>
              <input
                type="checkbox"
                [checked]="onlyTouched()"
                (change)="onlyTouched.set($any($event.target).checked)"
              />
              touched
            </label>
            <label>
              <input
                type="checkbox"
                [checked]="onlyDirty()"
                (change)="onlyDirty.set($any($event.target).checked)"
              />
              dirty
            </label>
            <label>
              <input
                type="checkbox"
                [checked]="onlyPending()"
                (change)="onlyPending.set($any($event.target).checked)"
              />
              pending
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>field</th><th>value</th><th>valid</th><th>touched</th>
                <th>dirty</th><th>pending</th><th>errors</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.path) {
                <tr>
                  <td
                    class="mdy-devtools__path"
                    title="Click to copy the field path"
                    (click)="copyText(row.path)"
                  >{{ row.path }}</td>
                  <td
                    class="mdy-devtools__path"
                    title="Click to copy the current value"
                    (click)="copyText(row.value)"
                  >{{ row.value }}</td>
                  <td [class.mdy-devtools__bad]="!row.valid">{{ row.valid ? "✓" : "✗" }}</td>
                  <td>{{ row.touched ? "✓" : "·" }}</td>
                  <td>{{ row.dirty ? "✓" : "·" }}</td>
                  <td>{{ row.pending ? "…" : "·" }}</td>
                  <td
                    class="mdy-devtools__bad mdy-devtools__path"
                    title="Click to copy the errors"
                    (click)="copyText(row.errors.join(' | '))"
                  >{{ row.errors.join(" | ") }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        <pre>{{ valueJson() }}</pre>
        @if (submitErrors().length > 0) {
          <pre class="mdy-devtools__bad">last submit errors: {{ submitErrors().join(" | ") }}</pre>
        }
      </div>
    }
  `,
})
export class MdyFormsDevtoolsComponent {
  /** The form model to inspect (an `mdyForm()` result or any adapter). */
  readonly form = input.required<MdyTypedFormLike>();

  /**
   * Typed handles to show as per-field rows (`[form.f.email, …]`).
   * When omitted, the rows are derived automatically from the form's
   * registered field names.
   */
  readonly fields = input<ReadonlyArray<MdyFieldHandle<unknown>>>([]);

  /** Start with the body expanded (the overlay opens it this way). */
  readonly expanded = input(false, { transform: booleanAttribute });

  /**
   * Extra field paths whose values are masked in the panel, in addition
   * to the built-in heuristic (paths containing password/token/card/…).
   */
  readonly maskFields = input<ReadonlyArray<string>>([]);

  /**
   * Field paths hidden from the devtools entirely — no row and no key in
   * the JSON view (masking shows `•••`; excluding shows nothing).
   */
  readonly excludeFields = input<ReadonlyArray<string>>([]);

  protected readonly open = linkedSignal(() => this.expanded());

  protected readonly nameFilter = signal("");
  protected readonly onlyInvalid = signal(false);
  protected readonly onlyTouched = signal(false);
  protected readonly onlyDirty = signal(false);
  protected readonly onlyPending = signal(false);

  protected readonly state = computed(() => {
    const s = this.form().state;
    return {
      valid: s.valid(),
      pending: s.pending(),
      submitting: s.submitting(),
      submitCount: s.submitCount(),
      canSubmit: s.canSubmit(),
    };
  });

  protected readonly valueJson = computed(() =>
    JSON.stringify(
      this._maskDeep(mdyFormSerialize(this.form().value()), ""),
      null,
      1,
    ),
  );

  protected readonly submitErrors = computed(() =>
    this.form()
      .state.lastSubmitErrors()
      .map((e) => `${e.path ?? "(form)"}: ${e.message}`),
  );

  protected readonly rows = computed((): readonly DevtoolsFieldRow[] => {
    const handles = this.fields();
    if (handles.length > 0) {
      return handles.map((f) => ({
        path: f.path,
        value: this._displayValue(f.path, f.value()),
        valid: f.valid(),
        touched: f.touched(),
        dirty: f.dirty(),
        pending: f.pending(),
        errors: f.errors().map((e) => `[${e.kind}] ${e.message}`),
      }));
    }
    // No explicit handles: derive the rows from the registered field names
    // (available on mdyForm() models, the declarative adapter and <mdy-form>).
    const form = this.form() as Partial<
      Record<"fieldNames", Signal<readonly string[]>>
    > &
      MdyTypedFormLike;
    const names = form.fieldNames?.() ?? [];
    return names.map((path) => {
      const state = form.getField(path)?.();
      return {
        path,
        value: this._displayValue(path, state?.value() ?? null),
        valid: state?.valid() ?? true,
        touched: state?.touched() ?? false,
        dirty: state?.dirty() ?? false,
        pending: state?.pending() ?? false,
        errors: state?.errors().map((e) => `[${e.kind}] ${e.message}`) ?? [],
      };
    });
  });

  protected readonly filteredRows = computed(() => {
    const filter = this.nameFilter().trim().toLowerCase();
    const invalidOnly = this.onlyInvalid();
    const excluded = this.excludeFields();
    return this.rows().filter(
      (row) =>
        !excluded.includes(row.path) &&
        (!filter || row.path.toLowerCase().includes(filter)) &&
        (!invalidOnly || !row.valid) &&
        (!this.onlyTouched() || row.touched) &&
        (!this.onlyDirty() || row.dirty) &&
        (!this.onlyPending() || row.pending),
    );
  });

  protected copyText(text: string): void {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
  }

  private _isMasked(path: string): boolean {
    return SENSITIVE_PATH.test(path) || this.maskFields().includes(path);
  }

  private _displayValue(path: string, value: unknown): string {
    if (this._isMasked(path) && value !== null && value !== "") return MASK;
    return JSON.stringify(mdyFormSerialize(value));
  }

  /** Masks sensitive-looking keys and drops excluded ones in the JSON view. */
  private _maskDeep(value: unknown, prefix: string): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return prefix && this._isMasked(prefix) && value !== null && value !== ""
        ? MASK
        : value;
    }
    const excluded = this.excludeFields();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !excluded.includes(prefix ? `${prefix}.${k}` : k))
        .map(([k, v]) => {
          const path = prefix ? `${prefix}.${k}` : k;
          return [k, this._maskDeep(v, path)];
        }),
    );
  }
}
