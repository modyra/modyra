import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
  MdyFormComponent,
  MdyInlineErrorsDirective,
  MdyLoadOptionsDirective,
  MdyOptionsLoader,
  MdySelectComponent,
} from "@modyra/angular/ui";

@Component({
  selector: "app-enterprise-select-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdySelectComponent,
    MdyInlineErrorsDirective,
    MdyLoadOptionsDirective,
  ],
  template: `
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
  `,
})
export class EnterpriseSelectSectionComponent {
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
}
