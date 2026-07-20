import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MdyDynamicFormComponent } from "@modyra/angular/ui";
import type { MdyDynamicField } from "@modyra/core";

@Component({
  selector: "app-dynamic-form-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyDynamicFormComponent],
  template: `
    <section class="demo-section">
      <h2>Dynamic form — from serializable config</h2>
      <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
        <code>&lt;mdy-dynamic-form [fields]&gt;</code> renders at runtime
        from a JSON-safe discriminated union — CMS / form-builder territory,
        signal-native and typed.
      </p>
      <mdy-dynamic-form [fields]="dynamicFields" (submitted)="onSubmitted($event)">
        <button type="submit">Send survey</button>
      </mdy-dynamic-form>
    </section>
  `,
})
export class DynamicFormSectionComponent {
  readonly dynamicFields: ReadonlyArray<MdyDynamicField> = [
    {
      kind: "text",
      name: "fullName",
      label: "Full name",
      validators: { required: true, minLength: 2 },
    },
    {
      kind: "email",
      name: "contactEmail",
      label: "Email",
      validators: { required: true, email: true },
    },
    {
      kind: "select",
      name: "topic",
      label: "Topic",
      options: [
        { value: "sales", label: "Sales" },
        { value: "support", label: "Support" },
      ],
      validators: { required: true },
    },
    { kind: "slider", name: "satisfaction", label: "Satisfaction", min: 0, max: 10, initialValue: 5 },
    { kind: "toggle", name: "newsletter", label: "Subscribe to newsletter" },
  ];

  onSubmitted(event: unknown): void {
    console.log("Dynamic form submitted with value:", event);
  }
}
