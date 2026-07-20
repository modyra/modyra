import { JsonPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
  MdyCheckboxComponent,
  MdyEmailDirective,
  MdyFormComponent,
  MdyFormSubmitEvent,
  MdyInlineErrorsDirective,
  MdyMinLengthDirective,
  MdyRequiredDirective,
  MdySelectComponent,
  MdySelectOption,
  MdyTextComponent,
} from "@modyra/angular";

/**
 * Minimal declarative-mode signup form, mirroring the README quickstart.
 * Everything runs against the published @modyra/angular package.
 */
@Component({
  selector: "app-root",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    MdyFormComponent,
    MdyTextComponent,
    MdySelectComponent,
    MdyCheckboxComponent,
    MdyInlineErrorsDirective,
    MdyRequiredDirective,
    MdyEmailDirective,
    MdyMinLengthDirective,
  ],
  template: `
    <main class="demo-card">
      <h1>modyra</h1>
      <p class="subtitle">Declarative signup form — @modyra/angular on npm</p>

      <mdy-form #form (submitted)="onSubmitted($event)">
        <mdy-control-text
          name="name"
          label="Name"
          placeholder="Ada Lovelace"
          mdyInlineErrors
          mdyRequired
          [mdyMinLength]="2"
        />

        <mdy-control-text
          name="email"
          label="Email"
          placeholder="ada@example.com"
          mdyInlineErrors
          mdyRequired
          mdyEmail
        />

        <mdy-control-select
          name="plan"
          label="Plan"
          [options]="planOptions"
        />

        <mdy-control-checkbox
          name="terms"
          label="I accept the terms and conditions"
          mdyRequired
        />

        <button type="submit" [disabled]="!form.state.canSubmit()">
          {{ form.state.submitting() ? "Submitting…" : "Sign up" }}
        </button>
      </mdy-form>

      @if (lastSubmit(); as value) {
        <div class="submit-result">
          <strong>Submitted!</strong>
          <pre>{{ value | json }}</pre>
        </div>
      }
    </main>
  `,
})
export class AppComponent {
  readonly planOptions: ReadonlyArray<MdySelectOption<string>> = [
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
    { value: "team", label: "Team" },
  ];

  readonly lastSubmit = signal<Record<string, unknown> | null>(null);

  onSubmitted(event: MdyFormSubmitEvent<Record<string, unknown>>): void {
    this.lastSubmit.set(event.value);
  }
}
