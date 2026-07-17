import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ContactFormSectionComponent } from "./sections/contact-form-section.component";
import {
  DesignSystemConfig,
  DesignSystemSectionComponent,
} from "./sections/design-system-section.component";
import { CvaInteropSectionComponent } from "./sections/cva-interop-section.component";
import { DynamicFormSectionComponent } from "./sections/dynamic-form-section.component";
import { EnterpriseSelectSectionComponent } from "./sections/enterprise-select-section.component";
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
    </main>
  `,
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);

  readonly designSystemConfig = signal<DesignSystemConfig>({
    theme: "default",
    primaryColor: "#6750a4",
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
        const filename =
          theme === "default" ? "modyra.css" : `modyra-${theme}.css`;
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

  onDesignSystemConfigChange(config: DesignSystemConfig): void {
    this.designSystemConfig.set(config);
  }
}
