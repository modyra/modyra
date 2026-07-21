import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { MdyFormSubmitEvent, MdySelectOption } from "@modyra/angular/adapter";
import {
  MdyCheckboxComponent,
  MdyConditionalOptionsDirective,
  MdyDatePickerComponent,
  MdyDateRangePickerComponent,
  MdyEmailDirective,
  MdyFileComponent,
  MdyFloatingLabelsDirective,
  MdyFormComponent,
  MdyInlineErrorsDirective,
  MdyMaxDirective,
  MdyMaxLengthDirective,
  MdyMinDirective,
  MdyMinLengthDirective,
  MdyMultiselectComponent,
  MdyNumberComponent,
  MdyOptionDirective,
  MdyOptionsAutoLoadingDirective,
  MdyPrefixDirective,
  MdyRadioGroupComponent,
  MdyRequiredDirective,
  MdySegmentedButtonComponent,
  MdySelectComponent,
  MdySliderComponent,
  MdySuffixDirective,
  MdySupportingTextDirective,
  MdyTextareaComponent,
  MdyTextComponent,
  MdyTimepickerComponent,
  MdyToggleComponent,
} from "@modyra/angular/ui";
import { mdyFormSerialize } from "@modyra/core/serialize";
import { concat, delay, of, switchMap } from "rxjs";
import type { DesignSystemConfig } from "./design-system-section.component";

@Component({
  selector: "app-contact-form-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyTextComponent,
    MdyNumberComponent,
    MdySelectComponent,
    MdyCheckboxComponent,
    MdyTextareaComponent,
    MdyDatePickerComponent,
    MdyDateRangePickerComponent,
    MdyMultiselectComponent,
    MdyInlineErrorsDirective,
    MdyToggleComponent,
    MdyOptionDirective,
    MdyTimepickerComponent,
    MdyRadioGroupComponent,
    MdySliderComponent,
    MdyFileComponent,
    MdySegmentedButtonComponent,
    MdyPrefixDirective,
    MdySuffixDirective,
    MdySupportingTextDirective,
    MdyConditionalOptionsDirective,
    MdyFloatingLabelsDirective,
    MdyRequiredDirective,
    MdyEmailDirective,
    MdyMinDirective,
    MdyMaxDirective,
    MdyMinLengthDirective,
    MdyMaxLengthDirective,
    MdyOptionsAutoLoadingDirective,
  ],
  template: `
    <section style="margin-bottom: 2rem;">
      <div class="form-modifications">
        <button class="mdy-button" type="button" (click)="contactForm.reset()">
          Reset
        </button>

        <button class="mdy-button" type="button" (click)="patchContactForm(contactForm)">
          Patch (name → Demo User)
        </button>
      </div>

      <mdy-form #contactForm
        [formValue]="initialContactValues"
        [mdyFloatingLabels]="designSystemConfig().floating"
        [mdyFloatingLabelsDensity]="designSystemConfig().density"
        (submitted)="onSubmitted($event)"
      >
        <div class="form-row">
          <mdy-control-text
            name="firstName"
            label="First Name"
            placeholder="John"
            mdyInlineErrors
            mdyRequired
            [mdyMinLength]="2"
            [mdyMaxLength]="50"
          >
            <div *mdySupportingText>Enter your given name</div>
          </mdy-control-text>

          <mdy-control-text
            name="lastName"
            label="Last Name"
            placeholder="Doe"
            mdyInlineErrors
            mdyRequired
            [mdyMinLength]="2"
            [mdyMaxLength]="50"
          >
            <ng-template mdyPrefix>👤</ng-template>
            <div *mdySupportingText>Enter your legal family name</div>
          </mdy-control-text>
        </div>

        <div class="form-row">
          <mdy-control-text
            name="email"
            label="Email"
            placeholder="john.doe&#64;example.com"
            mdyInlineErrors
            mdyRequired
            mdyEmail
          >
            <button *mdySuffix type="button" (click)="0" style="background:none; border:none; cursor:pointer;">📧</button>
            <div *mdySupportingText>We'll never share your email</div>
          </mdy-control-text>

          <mdy-control-number
            name="age"
            label="Age"
            placeholder="25"
            [minValue]="0"
            [maxValue]="120"
            [mdyMin]="0"
            [mdyMax]="120"
          >
            <div *mdySupportingText>Must be between 0 and 120</div>
          </mdy-control-number>
        </div>

        <div class="form-row">
          <mdy-control-datepicker name="birthDate" label="Date of Birth">
            <div *mdySupportingText>Select from the calendar</div>
          </mdy-control-datepicker>

          <mdy-control-timepicker
            name="appointmentTime"
            label="Appointment Time"
          >
            <div *mdySupportingText>Pick a slot for your visit</div>
          </mdy-control-timepicker>

          <mdy-control-timepicker
            name="checkoutTime"
            label="Checkout (24h)"
            format="24h"
          >
            <div *mdySupportingText>24-hour format — value "HH:mm"</div>
          </mdy-control-timepicker>
        </div>

        <mdy-control-daterange
          name="travelDates"
          label="Travel Dates"
          minDate="2026-01-01"
          maxDate="2027-12-31"
        >
          <div *mdySupportingText>Select start and end dates</div>
        </mdy-control-daterange>

        <mdy-control-multiselect
          name="interests"
          label="Interests"
          [options]="interestOptions"
          [searchable]="true"
          mode="multi"
        >
          <div *mdySupportingText>Choose your favorite topics</div>
        </mdy-control-multiselect>

        <mdy-control-select
          name="country"
          label="Country"
          placeholder="Select a country…"
          [options]="countries"
          [searchable]="true"
        >
          <ng-template mdyOption let-opt>
            <span style="margin-right: 0.5rem">{{ countryFlags[opt.value] }}</span>
            {{ opt.label }}
          </ng-template>
          <div *mdySupportingText>Used for regional settings</div>
        </mdy-control-select>

        <mdy-control-select
          name="province"
          label="Province / State (Select)"
          placeholder="Select a province…"
          [mdyDependsOn]="'country'"
          [mdyOptionsMap]="provincesByCountry"
        >
          <div *mdySupportingText>Dependent on Country selection</div>
        </mdy-control-select>

        <mdy-control-multiselect
          name="provinceMs"
          label="Province / State (MultiSelect)"
          [mdyDependsOn]="'country'"
          [mdyOptionsMap]="provincesByCountry"
          [searchable]="true"
        >
          <div *mdySupportingText>Select multiple regions</div>
        </mdy-control-multiselect>

        <mdy-control-textarea
          name="bio"
          label="Bio"
          placeholder="Tell us about yourself…"
          [rows]="3"
          [mdyMaxLength]="500"
        >
          <div *mdySupportingText>Maximum 500 characters</div>
        </mdy-control-textarea>

        <div style="margin: 1.5rem 0; padding: 1.5rem; border: 1px dashed var(--mdy-outline-variant); border-radius: 12px; background: rgba(var(--mdy-primary-rgb), 0.02);">
          <h4 style="margin: 0 0 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mdy-primary); font-weight: 800;">
            🧪 Async Loading Test
          </h4>
          <div style="display: flex; gap: 1rem; align-items: flex-end;">
            <mdy-control-select
              name="asyncData"
              label="Async Options (Auto Loading)"
              placeholder="Waiting for data..."
              loadingText="Recupero opzioni in corso..."
              [options]="asyncOptions() || []"
              mdyOptionsAutoLoading
            >
              <div *mdySupportingText>This control uses [mdyOptionsAutoLoading]</div>
            </mdy-control-select>

            <button type="button" class="mdy-button" style="height: 48px;" (click)="reloadAsyncOptions()">
              Reload Options
            </button>
          </div>
        </div>

        <div class="form-row">
          <mdy-control-checkbox
            name="acceptTerms"
            label="I accept the terms and conditions"
          >
            <div *mdySupportingText>Legal requirement</div>
          </mdy-control-checkbox>

          <mdy-control-toggle
            name="newsletter"
            label="Subscribe to newsletter"
          >
            <div *mdySupportingText>Occasional marketing updates</div>
          </mdy-control-toggle>
        </div>

        <mdy-control-radio
          name="preferredContact"
          label="Preferred Contact Method"
          [options]="contactOptions"
          layout="horizontal"
          mdyRequired
        >
          <div *mdySupportingText>How should we reach you?</div>
        </mdy-control-radio>

        <mdy-control-slider
          name="satisfaction"
          label="Rate your experience"
          [min]="1"
          [max]="10"
          [step]="1"
        >
          <div *mdySupportingText>1 = Poor, 10 = Excellent</div>
        </mdy-control-slider>

        <mdy-control-file
          name="resume"
          label="Upload Resume (PDF only)"
          accept=".pdf"
          (fileSelected)="onFileSelected($event)"
        >
          <div *mdySupportingText>Only PDF files are accepted</div>
        </mdy-control-file>

        <mdy-control-segmented
          name="frequency"
          label="Contact Frequency"
          [options]="frequencyOptions"
        >
          <div *mdySupportingText>Delivery schedule for messages</div>
        </mdy-control-segmented>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-top: 0.5rem;">
          <button type="submit" [disabled]="!contactForm.state.canSubmit()">
            @if (contactForm.state.submitting()) {
              Submitting…
            } @else {
              Submit
            }
          </button>
        </div>
      </mdy-form>

      @if (lastSubmitResult()) {
        <div class="submit-result">
          <strong>Submitted successfully!</strong>
          <pre>{{ lastSubmitResult() }}</pre>
        </div>
      }
    </section>
  `,
})
export class ContactFormSectionComponent {
  readonly designSystemConfig = input.required<DesignSystemConfig>();

  readonly lastSubmitResult = signal<string | null>(null);

  onSubmitted(event: MdyFormSubmitEvent<Record<string, unknown>>): void {
    this.lastSubmitResult.set(
      JSON.stringify(mdyFormSerialize(event.value), null, 2),
    );
    console.log("Form submitted with value:", event.value);
  }

  onFileSelected(file: File | File[] | null): void {
    console.log("File selected before submit:", file);
  }

  patchContactForm(form: MdyFormComponent<Record<string, unknown>>): void {
    form.patchValue({ firstName: "Demo", lastName: "User", email: "demo@example.com" });
  }

  readonly initialContactValues = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    country: "it",
    province: "RM",
    provinceMs: ["RM"],
    interests: ["testing"],
    newsletter: false,
    acceptTerms: false,
    preferredContact: "email",
    satisfaction: 5,
    frequency: "weekly",
  };

  readonly countries: readonly MdySelectOption[] = [
    { value: "it", label: "Italy" },
    { value: "us", label: "United States" },
    { value: "uk", label: "United Kingdom" },
    { value: "de", label: "Germany" },
    { value: "fr", label: "France" },
    { value: "es", label: "Spain" },
    { value: "jp", label: "Japan" },
  ];

  readonly countryFlags: Record<string, string> = {
    it: "🇮🇹",
    us: "🇺🇸",
    uk: "🇬🇧",
    de: "🇩🇪",
    fr: "🇫🇷",
    es: "🇪🇸",
    jp: "🇯🇵",
  };

  readonly provincesByCountry: Record<string, MdySelectOption[]> = {
    it: [
      { value: "RM", label: "Roma" },
      { value: "MI", label: "Milano" },
      { value: "NA", label: "Napoli" },
      { value: "TO", label: "Torino" },
    ],
    us: [
      { value: "CA", label: "California" },
      { value: "NY", label: "New York" },
      { value: "TX", label: "Texas" },
      { value: "FL", label: "Florida" },
    ],
    uk: [
      { value: "LDN", label: "London" },
      { value: "MAN", label: "Manchester" },
      { value: "BIR", label: "Birmingham" },
    ],
  };

  readonly interestOptions: readonly MdySelectOption[] = [
    { value: "angular", label: "Angular" },
    { value: "signals", label: "Signals" },
    { value: "rxjs", label: "RxJS" },
    { value: "typescript", label: "TypeScript" },
    { value: "testing", label: "Testing" },
    { value: "ngrx", label: "NgRx" },
    { value: "ssr", label: "SSR" },
    { value: "a11y", label: "Accessibility" },
    { value: "perf", label: "Performance" },
    { value: "animations", label: "Animations" },
    { value: "pwa", label: "PWA" },
    { value: "graphql", label: "GraphQL" },
    { value: "docker", label: "Docker" },
    { value: "ci-cd", label: "CI/CD" },
  ];

  readonly contactOptions: readonly MdySelectOption[] = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "sms", label: "SMS" },
  ];

  readonly frequencyOptions: readonly MdySelectOption[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  private readonly _asyncReloadTrigger = signal(0);

  readonly asyncOptions = toSignal(
    toObservable(this._asyncReloadTrigger).pipe(
      switchMap(() => concat(
        of([]), // Clear immediately to trigger loading state
        of([
          { value: 'opt1', label: 'Option 1 (Delayed)' },
          { value: 'opt2', label: 'Option 2 (Delayed)' },
          { value: 'opt3', label: 'Option 3 (Delayed)' },
        ]).pipe(delay(3000))
      ))
    ),
    { initialValue: [] as MdySelectOption[] }
  );

  reloadAsyncOptions(): void {
    this._asyncReloadTrigger.update(v => v + 1);
  }
}
