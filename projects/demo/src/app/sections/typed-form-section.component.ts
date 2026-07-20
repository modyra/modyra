import { ChangeDetectionStrategy, Component } from "@angular/core";
import { field, group, mdyForm, MdyFormSubmitEvent } from "@modyra/angular/adapter";
import {
  MdyDevtoolsDirective,
  MdyFormComponent,
  MdyNumberComponent,
  MdyTextComponent,
} from "@modyra/angular/ui";
import {
  crossField,
  email as mdyEmail,
  min as mdyMin,
  required as mdyRequiredValidator,
  serverValidator,
} from "@modyra/core";

// Simulated availability endpoint. The abort signal cancels the request
// when a newer keystroke supersedes the run (last-wins), so stale replies
// never land on the field.
function isUsernameTaken(value: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(["admin", "root"].includes(value)), 350);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

@Component({
  selector: "app-typed-form-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyDevtoolsDirective,
    MdyTextComponent,
    MdyNumberComponent,
  ],
  template: `
    <section class="demo-section">
      <h2>Typed form — mdyForm()</h2>
      <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
        Schema-first: initial values and validators live in TypeScript,
        <code>[field]="typedForm.f.…"</code> replaces the stringly
        <code>name</code> attribute — a typo does not compile. Nested
        groups map to <code>address.city</code> paths. The username runs a
        debounced, cancellable <code>serverValidator</code> — try
        <code>admin</code> or <code>root</code>.
      </p>

      <mdy-form [form]="typedForm" mdyDevtools (submitted)="onSubmitted($event)">
        <div class="form-row" style="align-items: center;">
          <mdy-control-text
            [field]="typedForm.f.username"
            label="Username"
            mdyInlineErrors
          />
          @if (typedForm.f.username.pending()) {
            <span class="mdy-supporting-text" role="status">checking…</span>
          }
        </div>

        <div class="form-row">
          <mdy-control-text
            [field]="typedForm.f.fullName"
            label="Full Name"
            mdyInlineErrors
          />
          <mdy-control-text
            [field]="typedForm.f.email"
            label="Email"
            type="email"
            mdyInlineErrors
          />
        </div>

        <div class="form-row">
          <mdy-control-number
            [field]="typedForm.f.age"
            label="Age (18+)"
            mdyInlineErrors
          />
          <mdy-control-text
            [field]="typedForm.f.address.city"
            label="City"
            mdyInlineErrors
          />
          <mdy-control-text
            [field]="typedForm.f.address.zip"
            label="ZIP"
            mdyInlineErrors
          />
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem;">
          <button type="submit" [disabled]="!typedForm.state.canSubmit()">
            Submit typed
          </button>
          <button class="mdy-button" type="button" (click)="typedForm.reset()">
            Reset
          </button>
          <button
            class="mdy-button"
            type="button"
            (click)="typedForm.patch({ address: { city: 'Milan' } })"
          >
            Patch city → Milan
          </button>
          <button
            class="mdy-button"
            type="button"
            [disabled]="!typedForm.canUndo()"
            (click)="typedForm.undo()"
          >
            Undo
          </button>
          <button
            class="mdy-button"
            type="button"
            [disabled]="!typedForm.canRedo()"
            (click)="typedForm.redo()"
          >
            Redo
          </button>
          <code style="font-size: 0.75rem;">
            valid: {{ typedForm.state.valid() }} ·
            city: {{ typedForm.f.address.city.value() }}
          </code>
        </div>
      </mdy-form>

      <p style="font-size: 0.75rem; color: var(--mdy-on-surface-variant); margin-top: 1rem;">
        🔍 Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> to inspect the
        focused form in a draggable devtools overlay (✕ or Esc to close).
      </p>
    </section>
  `,
})
export class TypedFormSectionComponent {
  readonly typedForm = mdyForm(
    {
      // Debounced, cancellable availability check with a 2s timeout.
      username: field(
        "",
        [mdyRequiredValidator()],
        serverValidator(
          async (value, { signal }) =>
            (await isUsernameTaken(value, signal)) ? "Username is already taken" : null,
          { debounceMs: 300, timeoutMs: 2000 },
        ),
      ),
      fullName: field("", [mdyRequiredValidator()]),
      email: field("", [mdyRequiredValidator(), mdyEmail()]),
      age: field<number | null>(null, [mdyMin(18)]),
      address: group({
        city: field("Rome"),
        zip: field(""),
      }),
    },
    {
      // Cross-field rule: a ZIP without its city is invalid on both fields.
      validators: [
        crossField(["address.city", "address.zip"], (v: { readonly address: { readonly city: string; readonly zip: string } }) =>
          v.address.zip !== "" && v.address.city === ""
            ? "ZIP requires a city"
            : null,
        ),
      ],
      history: true, // enables undo()/redo()
      draft: "demo-typed-form", // autosaved to localStorage, restored on reload
    },
  );

  onSubmitted(event: MdyFormSubmitEvent<Record<string, unknown>>): void {
    console.log("Typed form submitted with value:", event.value);
  }
}
