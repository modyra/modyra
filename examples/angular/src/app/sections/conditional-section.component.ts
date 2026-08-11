import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { field, group, mdyForm } from "@modyra/angular/adapter";
import { MdyFormComponent, MdySelectComponent, MdyTextComponent } from "@modyra/angular/ui";
import { maxLength, minLength, pattern, required } from "@modyra/core";

/**
 * A section the form only asks about under a condition, and the attributes nobody wrote.
 *
 * Two engine properties on one screen: the company fields are declared always and are in play only
 * while the account is a company — out of play they are not validated, not submitted, and what was
 * typed into them is kept — and the code control carries `maxlength` and `pattern` because its rules
 * state them. Nothing in this template hides, disables, re-validates or writes an attribute.
 */
@Component({
  selector: "app-conditional-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MdyFormComponent, MdySelectComponent, MdyTextComponent],
  template: `
    <section class="demo-section">
      <h2>A section that only counts sometimes</h2>
      <p class="section-lead">
        The company details are declared like everything else and are <strong>out of play</strong>
        while the account is personal. The code carries <code>maxlength</code> and
        <code>pattern</code> because its rules say so.
      </p>

      <mdy-form [form]="account">
        <mdy-control-select
          [field]="account.f.kind"
          label="Account"
          [options]="accountKinds"
        />
        <mdy-control-text [field]="account.f.company.name" label="Company name" />
        <mdy-control-text [field]="account.f.company.code" label="Code" />
      </mdy-form>

      <pre class="conditional-state" data-conditional-state>{{ report() }}</pre>
    </section>
  `,
})
export class ConditionalSectionComponent {
  protected readonly accountKinds = [
    { value: "personal", label: "Personal" },
    { value: "company", label: "Company" },
  ];

  readonly account = mdyForm({
    kind: field("personal"),
    company: group(
      {
        name: field("", [required()]),
        code: field("", [minLength(2), maxLength(8), pattern(/^[A-Z]+$/)]),
      },
      { when: (_section, form) => form["kind"] === "company" },
    ),
  });

  protected readonly report = computed(() => {
    const value = this.account.value();
    return JSON.stringify(
      {
        valid: this.account.state.valid(),
        submitted: Object.keys(this.account.submitValue()),
        kept: value["company"],
        codeCarries: this.account.f.company.code.constraints(),
      },
      null,
      2,
    );
  });
}
