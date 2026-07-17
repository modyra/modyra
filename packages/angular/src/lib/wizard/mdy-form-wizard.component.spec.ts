import { Component, viewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { required } from "@modyra/core";
import { field, mdyForm, MdyTypedForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyFormWizardComponent } from "./mdy-form-wizard.component";
import { MdyWizardStepComponent } from "./mdy-wizard-step.component";

// The steps declare their fields via the schema handles — no rendered
// controls are needed to exercise the navigation/validation logic.
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyFormWizardComponent, MdyWizardStepComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-form-wizard (finished)="finishedCount = finishedCount + 1">
        <mdy-wizard-step label="Account" [fields]="[form.f.email]">
          <p>account step</p>
        </mdy-wizard-step>
        <mdy-wizard-step label="Profile" [fields]="[form.f.city]">
          <p>profile step</p>
        </mdy-wizard-step>
      </mdy-form-wizard>
    </mdy-form>
  `,
})
class WizardHostComponent {
  readonly form: MdyTypedForm<{
    email: ReturnType<typeof field<string>>;
    city: ReturnType<typeof field<string>>;
  }> = mdyForm({
    email: field("", [required()]),
    city: field("", [required()]),
  });
  readonly wizard = viewChild.required(MdyFormWizardComponent);
  finishedCount = 0;
}

describe("MdyFormWizardComponent", () => {
  async function setup(): Promise<{
    host: WizardHostComponent;
    wizard: MdyFormWizardComponent;
    detect: () => void;
  }> {
    const fixture = TestBed.createComponent(WizardHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      host: fixture.componentInstance,
      wizard: fixture.componentInstance.wizard(),
      detect: () => fixture.detectChanges(),
    };
  }

  it("shows only the active step", async () => {
    const { wizard, detect } = await setup();
    expect(wizard.activeIndex()).toBe(0);
    detect();
    const steps = document.querySelectorAll("mdy-wizard-step");
    expect((steps[0] as HTMLElement).hidden).toBe(false);
    expect((steps[1] as HTMLElement).hidden).toBe(true);
  });

  it("blocks next() on an invalid step and marks its fields touched", async () => {
    const { host, wizard } = await setup();
    wizard.next(); // email is required and empty
    expect(wizard.activeIndex()).toBe(0);
    expect(host.form.f.email.touched()).toBe(true);
    expect(host.finishedCount).toBe(0);
  });

  it("advances when the step is valid and fires finished on the last", async () => {
    const { host, wizard } = await setup();
    host.form.f.email.set("a@b.co");
    wizard.next();
    expect(wizard.activeIndex()).toBe(1);

    host.form.f.city.set("Rome");
    wizard.next(); // last step → finished
    expect(host.finishedCount).toBe(1);
    expect(wizard.activeIndex()).toBe(1);
  });

  it("goTo jumps backwards freely but forwards only across valid steps", async () => {
    const { host, wizard } = await setup();
    expect(wizard.activeIndex()).toBe(0);
    wizard.goTo(1); // email invalid → blocked
    expect(wizard.activeIndex()).toBe(0);

    host.form.f.email.set("a@b.co");
    wizard.goTo(1);
    expect(wizard.activeIndex()).toBe(1);

    wizard.goTo(0); // backwards always allowed
    expect(wizard.activeIndex()).toBe(0);
  });

  it("exposes progress and isLast", async () => {
    const { host, wizard } = await setup();
    expect(wizard.progress()).toBe(0.5);
    expect(wizard.isLast()).toBe(false);
    host.form.f.email.set("a@b.co");
    wizard.next();
    expect(wizard.progress()).toBe(1);
    expect(wizard.isLast()).toBe(true);
  });
});
