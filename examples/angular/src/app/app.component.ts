import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ContactFormSectionComponent } from "./sections/contact-form-section.component";
import { CvaInteropSectionComponent } from "./sections/cva-interop-section.component";
import {
  DesignSystemConfig,
  DesignSystemSectionComponent,
} from "./sections/design-system-section.component";
import { DynamicFormSectionComponent } from "./sections/dynamic-form-section.component";
import { EnterpriseSelectSectionComponent } from "./sections/enterprise-select-section.component";
import { ConditionalSectionComponent } from "./sections/conditional-section.component";
import { KeyedRowsSectionComponent } from "./sections/keyed-rows-section.component";
import { OrdersSectionComponent } from "./sections/orders-section.component";
import { InvoicesSectionComponent } from "./sections/invoices-section.component";
import { ContractsSectionComponent } from "./sections/contracts-section.component";
import { TypedFormSectionComponent } from "./sections/typed-form-section.component";
import { ZodFormSectionComponent } from "./sections/zod-form-section.component";

@Component({
  selector: "app-root",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    // Feature sections
    DesignSystemSectionComponent,
    ContactFormSectionComponent,
    TypedFormSectionComponent,
    ZodFormSectionComponent,
    CvaInteropSectionComponent,
    DynamicFormSectionComponent,
    EnterpriseSelectSectionComponent,
    KeyedRowsSectionComponent,
    OrdersSectionComponent,
    InvoicesSectionComponent,
    ContractsSectionComponent,
    ConditionalSectionComponent,
  ],
  template: `
    <main class="demo-card">
      <h1>modyra Demo</h1>
      <p class="subtitle">
        A declarative, type-safe, reactive form system built on Angular Signals.
      </p>

      <app-design-system-section (configChange)="onDesignSystemConfigChange($event)" />

      <app-contact-form-section [designSystemConfig]="designSystemConfig()" />

      <app-typed-form-section />

      <app-zod-form-section />

      <app-cva-interop-section />

      <app-dynamic-form-section />

      <app-enterprise-select-section />

      <app-keyed-rows-section />
      <app-orders-section />
      <app-invoices-section />
      <app-contracts-section />

      <app-conditional-section />
    </main>
  `,
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);

  readonly designSystemConfig = signal<DesignSystemConfig>({
    theme: "default",
    primaryColor: "#f0b511",
    density: -3,
    floating: false,
  });

  constructor() {
    effect(() => {
      const config = this.designSystemConfig();

      const link = this.document.getElementById(
        "mdy-theme-link",
      ) as HTMLLinkElement;
      if (link) {
        const theme = config.theme || "default";
        // Every theme resolves to `modyra-<name>.css`, the default included. It used to map to
        // `modyra.css`, which is the structural layer `modyra-foundation.css` imports rather than a
        // theme — so "Base Theme" rendered the foundation without Material's field, and the
        // floating label was missing from it.
        link.href = `styles/modyra-${theme}.css`;
      }

      // One property, because there is one place a brand colour is declared now. This used to set
      // `--mdy-primary` as well, and had to: the themes declared their own primary at that short
      // tier, so setting only the `sys` one could not reach them. Setting both then *froze* the
      // bridge — an inline `--mdy-primary` outranks the rule that derives it — so the palette could
      // no longer follow. The whole palette derives from this single line.
      this.document.documentElement.style.setProperty(
        "--mdy-sys-color-primary",
        config.primaryColor,
      );
    });
  }

  onDesignSystemConfigChange(config: DesignSystemConfig): void {
    this.designSystemConfig.set(config);
  }
}
