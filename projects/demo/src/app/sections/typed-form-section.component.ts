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
} from "@modyra/core";

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
        groups map to <code>address.city</code> paths.
      </p>

      <mdy-form [form]="typedForm" mdyDevtools (submitted)="onSubmitted($event)">
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
