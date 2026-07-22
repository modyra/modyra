import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { MdyDynamicFormComponent } from "@modyra/angular/ui";
import { type MdyFormSubmitEvent } from "@modyra/core";
import {
  parseDynamicForm,
  type MdyDynamicField,
} from "@modyra/core/dynamic-config";

interface RustSubmissionResponse {
  readonly ok: boolean;
  readonly submission_id?: string;
  readonly errors?: ReadonlyArray<{
    readonly path: string | null;
    readonly kind: string;
    readonly message: string;
  }>;
}

@Component({
  selector: "app-dynamic-form-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyDynamicFormComponent],
  template: `
    <section class="demo-section">
      <h2>Dynamic checkout - served by Rust</h2>
      <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
        Axum converts a Rust checkout business object into Contract v2 JSON.
        Angular fetches it as <code>unknown</code>, validates it with
        <code>parseDynamicForm(..., {{ '{' }} mode: 'strict' {{ '}' }})</code>,
        then renders the accepted fields with
        <code>&lt;mdy-dynamic-form [fields]&gt;</code>.
      </p>

      @if (loading()) {
        <p role="status">Loading checkout contract from Rust...</p>
      } @else if (loadError()) {
        <p role="alert">{{ loadError() }}</p>
        <button type="button" (click)="load()">Retry</button>
      } @else {
        <mdy-dynamic-form
          [fields]="dynamicFields()"
          (submitted)="onSubmitted($event)"
        >
          <button type="submit" [disabled]="submitting()">
            {{ submitting() ? "Sending to Rust..." : "Place order" }}
          </button>
        </mdy-dynamic-form>
      }

      @if (resultMessage()) {
        <pre aria-live="polite">{{ resultMessage() }}</pre>
      }
    </section>
  `,
})
export class DynamicFormSectionComponent {
  private readonly http = inject(HttpClient);
  private readonly api = "http://127.0.0.1:3000/v1/forms/checkout";

  readonly dynamicFields = signal<ReadonlyArray<MdyDynamicField>>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly resultMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.get<unknown>(this.api).subscribe({
      next: (input) => {
        const parsed = parseDynamicForm(input, { mode: "strict" });
        if (!parsed.ok) {
          console.error("Invalid Contract v2 from Rust", parsed.diagnostics);
          this.loadError.set("Rust returned an invalid Modyra form contract.");
        } else {
          this.dynamicFields.set(parsed.fields);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        console.error("Rust form API unavailable", error);
        this.loadError.set(
          "Cannot reach Rust on 127.0.0.1:3000. Start modyra-axum-form-server-example.",
        );
        this.loading.set(false);
      },
    });
  }

  onSubmitted(event: MdyFormSubmitEvent<Record<string, unknown>>): void {
    this.submitting.set(true);
    this.resultMessage.set(null);
    this.http.post<RustSubmissionResponse>(`${this.api}/submissions`, {
      formRevision: 1,
      values: event.value,
    }).subscribe({
      next: (response) => {
        this.resultMessage.set(
          `Rust accepted the order: ${response.submission_id ?? "no id returned"}`,
        );
        this.submitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        const response = error.error as RustSubmissionResponse | undefined;
        if (error.status === 422 && response?.errors?.length) {
          this.resultMessage.set(
            response.errors
              .map((item) => `${item.path ?? "form"}: ${item.message}`)
              .join("\n"),
          );
        } else {
          this.resultMessage.set(`Rust submission failed: HTTP ${error.status}`);
        }
        this.submitting.set(false);
      },
    });
  }
}
