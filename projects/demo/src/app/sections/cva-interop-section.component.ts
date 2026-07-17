import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MdyCvaDirective } from "@modyra/angular/interop";
import { MdyTextComponent } from "@modyra/angular/ui";

@Component({
  selector: "app-cva-interop-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MdyTextComponent, MdyCvaDirective],
  template: `
    <section class="demo-section">
      <h2>Interop — renderers inside Reactive Forms</h2>
      <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
        <code>mdyCva</code> from <code>&#64;mdy-signals/forms/interop</code>:
        any renderer works with <code>formControlName</code> — incremental
        adoption in existing codebases, no <code>&lt;mdy-form&gt;</code> needed.
      </p>
      <form [formGroup]="legacyGroup">
        <mdy-control-text
          mdyCva
          name="legacyEmail"
          formControlName="email"
          label="Email (FormControl)"
        />
        <code style="font-size: 0.75rem;">
          control value: {{ legacyGroup.controls.email.value }}
        </code>
      </form>
    </section>
  `,
})
export class CvaInteropSectionComponent {
  readonly legacyGroup = new FormGroup({
    email: new FormControl("from@reactive.forms"),
  });
}
