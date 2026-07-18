import { ChangeDetectionStrategy, Component, computed, effect, output, viewChild } from "@angular/core";
import { MdySelectOption } from "@modyra/angular/adapter";
import {
  MdyColorsComponent,
  MdyFormComponent,
  MdySegmentedButtonComponent,
  MdySelectComponent,
  MdyToggleComponent,
} from "@modyra/angular/ui";

export interface DesignSystemConfig {
  readonly theme: "default" | "material" | "ios" | "ionic";
  readonly primaryColor: string;
  readonly density: number;
  readonly floating: boolean;
}

@Component({
  selector: "app-design-system-section",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyColorsComponent,
    MdySelectComponent,
    MdyToggleComponent,
    MdySegmentedButtonComponent,
  ],
  template: `
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

          <mdy-form #dsForm [formValue]="initialDesignSystemValues">
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
    </section>
  `,
})
export class DesignSystemSectionComponent {
  readonly configChange = output<DesignSystemConfig>();

  private readonly designSystemFormRef =
    viewChild<MdyFormComponent<Record<string, unknown>>>("dsForm");

  private readonly designSystemConfig = computed(() => {
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
    effect(() => this.configChange.emit(this.designSystemConfig()));
  }

  readonly initialDesignSystemValues = {
    theme: "default",
    primaryColor: "#6750a4",
    density: -3,
    floating: false,
  };

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
}
