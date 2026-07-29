import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  untracked,
  viewChild,
} from "@angular/core";
import {
  buildDynamicFieldValidators,
  MdyDynamicField,
  MdyDynamicLayoutChild,
  MdyDynamicLayoutNode,
  MdyDynamicLayoutSlot,
} from "@modyra/core/dynamic-config";
import { layoutNodeAttributes, layoutSlotStyle, MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { MdyFormSubmitEvent } from "../core/types";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "../renderers/checkbox/checkbox-renderer.component";
import { MdyDatePickerComponent } from "../renderers/datepicker/datepicker.component";
import { MdyMultiselectComponent } from "../renderers/multiselect/multiselect-renderer.component";
import { MdyNumberComponent } from "../renderers/number/number-renderer.component";
import { MdyRadioGroupComponent } from "../renderers/radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "../renderers/segmented-button/segmented-button-renderer.component";
import { MdySelectComponent } from "../renderers/select/select-renderer.component";
import { MdySliderComponent } from "../renderers/slider/slider-renderer.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";
import { MdyTextareaComponent } from "../renderers/textarea/textarea-renderer.component";
import { MdyTimepickerComponent } from "../renderers/timepicker";
import { MdyToggleComponent } from "../renderers/toggle/toggle-renderer.component";

/**
 * Runtime form rendering from a serializable config — CMS, form builders,
 * low-code scenarios. The config is a discriminated union
 * ({@link MdyDynamicField}), so invalid kind/property combinations do not
 * compile when the config is authored in TypeScript, and validators are a
 * JSON-safe subset mapped to the library's pure validator functions.
 *
 * ```ts
 * readonly fields: MdyDynamicField[] = [
 *   { kind: "text", name: "firstName", label: "First name", validators: { required: true } },
 *   { kind: "select", name: "country", label: "Country", options: [...] },
 *   { kind: "slider", name: "budget", label: "Budget", min: 0, max: 100 },
 * ];
 * ```
 * ```html
 * <mdy-dynamic-form [fields]="fields" (submitted)="save($event)" />
 * ```
 */
@Component({
  selector: "mdy-dynamic-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdyFormComponent,
    MdyTextComponent,
    MdyTextareaComponent,
    MdyNumberComponent,
    MdySliderComponent,
    MdyCheckboxComponent,
    MdyToggleComponent,
    MdySelectComponent,
    MdyRadioGroupComponent,
    MdyMultiselectComponent,
    MdySegmentedButtonComponent,
    MdyDatePickerComponent,
    MdyTimepickerComponent,
    NgTemplateOutlet,
  ],
  template: `
    <mdy-form #form (submitted)="submitted.emit($event)">
      <!-- Declarative layout when the form declares one, otherwise the fields in order.
           Either way each field is rendered by one template, so the two paths cannot drift. -->
      @if (layout().length > 0) {
        @for (node of layout(); track node.id) {
          <ng-container *ngTemplateOutlet="layoutNode; context: { $implicit: node }" />
        }
        @for (f of unplacedFields(); track f.name) {
          <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
        }
      } @else {
        @for (f of fields(); track f.name) {
          <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
        }
      }
      <ng-content />

      <!-- A layout node holds fields or further nodes, so the template calls itself. -->
      <ng-template #layoutNode let-node>
        @if (node.kind === "section") {
          <fieldset [class]="layoutClasses.section" [attr.data-layout-id]="node.id">
            @if (node.label) {
              <legend [class]="layoutClasses.sectionLabel">{{ node.label }}</legend>
            }
            @for (child of node.children; track $index) {
              <ng-container *ngTemplateOutlet="layoutChild; context: { $implicit: child }" />
            }
          </fieldset>
        } @else {
          <div
            [class]="layoutClasses.columns"
            [style]="columnRowStyle(node)"
            [attr.data-layout-id]="node.id"
          >
            @for (column of node.columns; track $index) {
              <div [class]="layoutClasses.column" [style]="columnStyle(column)">
                @for (child of column; track $index) {
                  <ng-container *ngTemplateOutlet="layoutChild; context: { $implicit: child }" />
                }
              </div>
            }
          </div>
        }
      </ng-template>

      <ng-template #layoutChild let-child>
        @if (fieldNameOf(child); as name) {
          @if (fieldByName(name); as f) {
            <ng-container *ngTemplateOutlet="fieldTemplate; context: { $implicit: f }" />
          }
        } @else {
          <ng-container *ngTemplateOutlet="layoutNode; context: { $implicit: child }" />
        }
      </ng-template>

      <ng-template #fieldTemplate let-f>

          @switch (f.kind) {
            @case ("text") {
              <mdy-control-text
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="f.initialValue"
              />
            }
            @case ("email") {
              <mdy-control-text
                type="email"
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="f.initialValue"
              />
            }
            @case ("password") {
              <mdy-control-text
                type="password"
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="f.initialValue"
              />
            }
            @case ("textarea") {
              <mdy-control-textarea
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [initialValue]="f.initialValue"
              />
            }
            @case ("number") {
              <mdy-control-number
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [minValue]="f.min ?? null"
                [maxValue]="f.max ?? null"
                [step]="f.step ?? 1"
                [initialValue]="f.initialValue"
              />
            }
            @case ("slider") {
              <mdy-control-slider
                [name]="f.name"
                [label]="f.label ?? ''"
                [min]="f.min ?? 0"
                [max]="f.max ?? 100"
                [step]="f.step ?? 1"
                [initialValue]="f.initialValue"
              />
            }
            @case ("checkbox") {
              <mdy-control-checkbox
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="f.initialValue ?? false"
              />
            }
            @case ("toggle") {
              <mdy-control-toggle
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="f.initialValue ?? false"
              />
            }
            @case ("select") {
              <mdy-control-select
                [name]="f.name"
                [label]="f.label ?? ''"
                [placeholder]="f.placeholder ?? ''"
                [options]="f.options"
                [initialValue]="f.initialValue"
              />
            }
            @case ("radio") {
              <mdy-control-radio
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="f.initialValue"
              />
            }
            @case ("multiselect") {
              <mdy-control-multiselect
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="f.initialValue ?? []"
              />
            }
            @case ("segmented") {
              <mdy-control-segmented
                [name]="f.name"
                [label]="f.label ?? ''"
                [options]="f.options"
                [initialValue]="f.initialValue"
              />
            }
            @case ("datepicker") {
              <mdy-control-datepicker
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="f.initialValue"
              />
            }
            @case ("timepicker") {
              <mdy-control-timepicker
                [name]="f.name"
                [label]="f.label ?? ''"
                [initialValue]="f.initialValue"
              />
            }
          }
      </ng-template>
    </mdy-form>

  `,
})
export class MdyDynamicFormComponent {
  /** Serializable field configs, rendered in order. */
  readonly fields = input.required<ReadonlyArray<MdyDynamicField>>();

  /**
   * Contract v2 layout: sections and column rows, nestable. Fields the layout names render inside
   * it; anything it does not mention still renders, after — a partial layout arranges the part it
   * describes rather than hiding the rest.
   */
  readonly layout = input<ReadonlyArray<MdyDynamicLayoutNode>>([]);

  /** The class vocabulary is the contract's, so every adapter draws the same grid. */
  protected readonly layoutClasses = MDY_LAYOUT_CLASSES;

  /** Fields no layout node claims, rendered after the arranged ones. */
  protected readonly unplacedFields = computed(() => {
    const claimed = new Set<string>();
    const walk = (child: MdyDynamicLayoutChild): void => {
      if (typeof child === "string") { claimed.add(child); return; }
      if ("ref" in child) { claimed.add(child.ref); return; }
      if (child.kind === "section") child.children.forEach(walk);
      else child.columns.forEach((column) => column.forEach(walk));
    };
    this.layout().forEach(walk);
    return this.fields().filter((field) => !claimed.has(field.name));
  });

  /**
   * The field a slot names, or `null` when the child is a nested layout node.
   *
   * A bare string and a v3 `{ ref }` slot name a field the same way; the slot merely also says where
   * it sits. Answering with the name rather than a type guard keeps the template to one branch for
   * both spellings, which is what stops the two drifting apart.
   */
  protected fieldNameOf(child: MdyDynamicLayoutChild): string | null {
    if (typeof child === "string") return child;
    return "ref" in child ? child.ref : null;
  }

  /** A column's own placement, taken from the first v3 slot inside it. */
  protected columnStyle(column: ReadonlyArray<MdyDynamicLayoutChild>): Record<string, string> {
    const slot = column.find((child): child is MdyDynamicLayoutSlot => typeof child === "object" && "ref" in child);
    return { ...layoutSlotStyle(slot?.at) };
  }

  protected fieldByName(name: string): MdyDynamicField | undefined {
    return this.fields().find((field) => field.name === name);
  }

  /** The track count the foundation divides a column row by. */
  protected columnRowStyle(node: MdyDynamicLayoutNode): Record<string, string> {
    return layoutNodeAttributes(node).style;
  }

  /** Re-emitted from the inner `<mdy-form>`. */
  readonly submitted = output<MdyFormSubmitEvent<Record<string, unknown>>>();

  /** Inner form — exposed so consumers can call getValue()/reset()/submit(). */
  readonly form = viewChild.required<MdyFormComponent<Record<string, unknown>>>("form");

  constructor() {
    // Register the config validators on the inner form's registry; keyed by
    // field so config changes replace the previous set.
    effect(() => {
      const fields = this.fields();
      const form = this.form();
      untracked(() => {
        for (const f of fields) {
          // buildDynamicFieldValidators includes the automatic option
          // whitelist (anti-tampering) for select/radio/segmented/multiselect.
          const { validators, marksRequired } = buildDynamicFieldValidators(f);
          form.upsertValidators(f.name, "mdy-dynamic", validators, marksRequired);
        }
      });
    });
  }
}
