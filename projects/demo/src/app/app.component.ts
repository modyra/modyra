import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import {
  crossField,
  field,
  group,
  mdyEmail,
  mdyForm,
  mdyMin,
  mdyRequired as mdyRequiredValidator,
  MdyCheckboxComponent,
  MdyColorsComponent,
  MdyDynamicFormComponent,
  MdyDynamicField,
  MdyDevtoolsDirective,
  MdyFormWizardComponent,
  MdyLoadOptionsDirective,
  MdyOptionsLoader,
  MdyWizardStepComponent,
  MdyConditionalOptionsDirective,
  MdyDatePickerComponent,
  MdyDateRangePickerComponent,
  MdyEmailDirective,
  MdyFileComponent,
  MdyFloatingLabelsDirective,
  MdyFormComponent,
  mdyFormSerialize,
  MdyFormSubmitEvent,
  MdyInlineErrorsDirective,
  MdyMaxDirective,
  MdyMaxLengthDirective,
  MdyMinDirective,
  MdyMinLengthDirective,
  MdyMultiselectComponent,
  MdyNumberComponent,
  MdyOptionDirective,
  MdyPrefixDirective,
  MdyRadioGroupComponent,
  MdyRequiredDirective,
  MdySegmentedButtonComponent,
  MdySelectComponent,
  MdySelectOption,
  MdySliderComponent,
  MdySuffixDirective,
  MdySupportingTextDirective,
  MdyTextareaComponent,
  MdyTextComponent,
  MdyTimepickerComponent,
  MdyToggleComponent,
  MdyOptionsAutoLoadingDirective
} from "@modyra/forms";
import { MdyCvaDirective } from "@modyra/forms/interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mdyFormFromSchema } from "@modyra/forms/zod";
import { z } from "zod";
import { toSignal, toObservable } from "@angular/core/rxjs-interop";
import { concat, delay, of, switchMap } from "rxjs";

@Component({
  selector: "app-root",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyCvaDirective,
    MdyDynamicFormComponent,
    MdyDevtoolsDirective,
    MdyFormWizardComponent,
    MdyLoadOptionsDirective,
    ReactiveFormsModule,
    MdyWizardStepComponent,
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
    MdyColorsComponent,
    MdyPrefixDirective,
    MdySuffixDirective,
    MdySupportingTextDirective,
    MdyConditionalOptionsDirective,
    MdyFloatingLabelsDirective,
    // Declarative validator directives
    MdyRequiredDirective,
    MdyEmailDirective,
    MdyMinDirective,
    MdyMaxDirective,
    MdyMinLengthDirective,
    MdyMaxLengthDirective,
    MdyOptionsAutoLoadingDirective,
  ],
  template: `
    <main class="demo-card">
      <h1>modyra Demo</h1>
      <p class="subtitle">
        A declarative, type-safe, reactive form system built on Angular Signals.
      </p>

      <section style="margin-bottom: 2rem;">
          <details
            class="playground-accordion"
            style="margin-bottom: 2rem; border-radius: 12px; border: 1px solid var(--mdy-outline-variant);"
            [open]="false"
          >

            <summary style="padding: 1rem 1.25rem; list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; font-weight: 700; color: var(--mdy-primary); transition: background 0.2s;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1rem;">🎨</span>
                <span>Design System Inspector</span>
              </div>
              <div style="font-size: 0.65rem; color: var(--mdy-on-surface-variant); text-transform: uppercase; letter-spacing: 0.05em;">Configurazione Real-time</div>
            </summary>

            <div
              class="demo-config"
              style="padding: 1.5rem; border-top: 1px solid var(--mdy-outline-variant); position: relative;"
            >
              <!-- Decorative accent bar -->
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px;"></div>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                <div style="padding-right: 1.5rem;">
                  <h4 style="margin: 0 0 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mdy-primary); font-weight: 800;">
                    Real-time Theme Engine
                  </h4>
                  <p style="margin: 0; font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
                    Modifica istantaneamente l'esperienza visiva
                  </p>
                </div>
              </div>

              <mdy-form #dsForm [formValue]="initialDesignSystemValues"
                [mdyFloatingLabels]="designSystemConfig().floating"
              >
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start;">
                  <mdy-control-colors
                    name="primaryColor"
                    label="Brand Primary Color"
                    mdyInlineErrors
                  />

                  <mdy-control-select
                    name="theme"
                    label="Design System Theme"
                    [initialValue]="'default'"
                    [options]="themeOptions"
                    mdyInlineErrors
                  >
                    <ng-template mdyOption let-opt>
                      {{ opt.label }}
                    </ng-template>
                  </mdy-control-select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: center; margin-top: 1rem;">
                  <mdy-control-toggle
                    name="floating"
                    label="Interactive Floating Labels"
                  />

                  <mdy-control-segmented
                    name="density"
                    label="Layout Density"
                    [options]="densityOptions"
                  />
                </div>
              </mdy-form>
            </div>
          </details>

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
              <span style="margin-right: 0.5rem">{{
                countryFlags[opt.value]
              }}</span>
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

      <!-- ── Typed form (mdyForm) demo ─────────────────────────────────── -->
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

      <!-- ── Zod schema-first demo ─────────────────────────────────────── -->
      <section class="demo-section">
        <h2>Schema-first — Zod adapter</h2>
        <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
          <code>mdyFormFromSchema(z.object(…))</code> from
          <code>&#64;mdy-signals/forms/zod</code>: types, validators, messages
          and the cross-field <code>refine()</code> all come from the same
          schema the backend already uses.
        </p>

        <mdy-form [form]="zodForm" mdyDevtools (submitted)="onSubmitted($event)">
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

      <!-- ── CVA interop: renderer inside Reactive Forms ───────────────── -->
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

      <!-- ── Dynamic form from JSON config ─────────────────────────────── -->
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

      <!-- ── Enterprise select: server-side search + tagging ───────────── -->
      <section class="demo-section">
        <h2>Select — server-side search &amp; tagging</h2>
        <p style="font-size: 0.8125rem; color: var(--mdy-on-surface-variant);">
          <code>[mdyLoadOptions]</code> runs an async loader per (debounced)
          query with last-wins semantics; <code>allowCreate</code> shows a
          "Create …" row when nothing matches.
        </p>

        <mdy-form [formValue]="{}">
          <mdy-control-select
            name="remoteCity"
            label="City (remote)"
            searchable
            allowCreate
            [mdyLoadOptions]="searchCities"
            (optionCreated)="onCityCreated($event)"
            mdyInlineErrors
          />
        </mdy-form>
      </section>
    </main>
  `,
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);

  // ── Design System form — read field values via ViewChild ─────────────────────

  readonly designSystemFormRef =
    viewChild<MdyFormComponent<Record<string, unknown>>>("dsForm");

  readonly designSystemConfig = computed(() => {
    const form = this.designSystemFormRef();
    return {
      theme: (form?.getField("theme")?.()?.value() ?? "default") as
        | "default"
        | "material"
        | "ios"
        | "ionic",
      primaryColor: (form?.getField("primaryColor")?.()?.value() ??
        "#18181b") as string,
      density: (form?.getField("density")?.()?.value() ?? 0) as number,
      floating: (form?.getField("floating")?.()?.value() ?? false) as boolean,
    };
  });

  constructor() {
    effect(() => {
      const config = this.designSystemConfig();

      const link = this.document.getElementById(
        "mdy-theme-link",
      ) as HTMLLinkElement;
      if (link) {
        const theme = config.theme || "default";
        const filename =
          theme === "default"
            ? "modyra.css"
            : `modyra-${theme}.css`;
        link.href = `styles/${filename}`;
      }

      this.document.documentElement.style.setProperty(
        "--mdy-sys-color-primary",
        config.primaryColor,
      );

      this.document.documentElement.style.setProperty(
        "--mdy-primary",
        config.primaryColor,
      );
    });
  }

  // ── Typed form (mdyForm) ─────────────────────────────────────────────────────

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
        crossField(["address.city", "address.zip"], (v) =>
          v.address.zip !== "" && v.address.city === ""
            ? "ZIP requires a city"
            : null,
        ),
      ],
      history: true, // enables undo()/redo()
      draft: "demo-typed-form", // autosaved to localStorage, restored on reload
    },
  );

  // ── Zod schema-first form (@modyra/forms/zod) ────────────────────────────

  // ── CVA interop: classic Reactive Forms group ────────────────────────────────

  readonly legacyGroup = new FormGroup({
    email: new FormControl("from@reactive.forms"),
  });

  // ── Dynamic form config (could come from a CMS as JSON) ─────────────────────

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

  // ── Enterprise select: simulated server-side city search ─────────────────────

  private readonly allCities: string[] = [
    "Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna",
    "Florence", "Venice", "Verona",
  ];

  readonly searchCities: MdyOptionsLoader<string> = async (query) => {
    await new Promise((r) => setTimeout(r, 250)); // simulated latency
    const q = query.trim().toLowerCase();
    return this.allCities
      .filter((c) => !q || c.toLowerCase().includes(q))
      .map((c) => ({ value: c.toLowerCase(), label: c }));
  };

  onCityCreated(name: string): void {
    this.allCities.push(name); // next searches will find it
    console.log("City created:", name);
  }

  /** Last-step confirm of the wizard: submit the schema-first form. */
  submitZodForm(): void {
    void this.zodForm.submit((value) => {
      console.log("Registered:", value);
      return undefined;
    });
  }

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

  // ── Initial values ────────────────────────────────────────────────────────────

  readonly initialDesignSystemValues = {
    theme: "default",
    primaryColor: "#6750a4",
    density: -3,
    floating: false,
  };

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

  // ── Select / multiselect options ─────────────────────────────────────────────

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

  readonly themeOptions: readonly MdySelectOption[] = [
    { value: "default", label: "📄 Base Theme" },
    { value: "material", label: "🎨 Material 3" },
    { value: "ios", label: "🍎 iOS Design" },
    { value: "ionic", label: "⚡ Ionic Solid" },
  ];

  readonly densityOptions: readonly MdySelectOption<number>[] = [
    { value: 0, label: "Standard" },
    { value: -2, label: "Compact" },
    { value: -3, label: "Ultra" },
  ];

  // ── Submit handling ──────────────────────────────────────────────────────────

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

  // ── Async Loading Demo ──────────────────────────────────────────────────────

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
