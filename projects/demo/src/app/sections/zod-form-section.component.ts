import { ChangeDetectionStrategy, Component } from "@angular/core";
import { mdyFormFromSchema } from "@modyra/angular/zod";
import {
  MdyDevtoolsDirective,
  MdyFormComponent,
  MdyFormWizardComponent,
  MdyTextComponent,
  MdyWizardStepComponent,
} from "@modyra/angular/ui";
import { z } from "zod";

@Component({
  selector: "app-zod-form-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyDevtoolsDirective,
    MdyFormWizardComponent,
    MdyWizardStepComponent,
    MdyTextComponent,
  ],
  template: `
    <section class="demo-section">
      <h2>Schema-first — Zod adapter</h2>
      <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
        <code>mdyFormFromSchema(z.object(…))</code> from
        <code>&#64;mdy-signals/forms/zod</code>: types, validators, messages
        and the cross-field <code>refine()</code> all come from the same
        schema the backend already uses.
      </p>

      <mdy-form [form]="zodForm" mdyDevtools>
        <mdy-form-wizard (finished)="submitZodForm()">
          <mdy-wizard-step label="Account" [fields]="[zodForm.f.username]">
            <div class="form-row">
              <mdy-control-text
                [field]="zodForm.f.username"
                label="Username"
                mdyInlineErrors
              />
            </div>
          </mdy-wizard-step>
          <mdy-wizard-step
            label="Security"
            [fields]="[zodForm.f.password, zodForm.f.confirm]"
          >
            <div class="form-row">
              <mdy-control-text
                [field]="zodForm.f.password"
                label="Password"
                type="password"
                mdyInlineErrors
              />
              <mdy-control-text
                [field]="zodForm.f.confirm"
                label="Confirm password"
                type="password"
                mdyInlineErrors
              />
            </div>
          </mdy-wizard-step>
        </mdy-form-wizard>
      </mdy-form>
    </section>
  `,
})
export class ZodFormSectionComponent {
  readonly zodForm = mdyFormFromSchema(
    z
      .object({
        username: z.string().min(3, "At least 3 characters"),
        password: z.string().min(8, "At least 8 characters").default(""),
        confirm: z.string().default(""),
      })
      .refine((v) => v.password === v.confirm, {
        path: ["confirm"],
        message: "Passwords do not match",
      }),
  );

  /** Last-step confirm of the wizard: submit the schema-first form. */
  submitZodForm(): void {
    void this.zodForm.submit((value) => {
      console.log("Registered:", value);
      return undefined;
    });
  }
}
