import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  untracked,
  viewChild,
} from "@angular/core";
import {
  buildDynamicValidators,
  MdyDynamicField,
} from "@modyra/core/dynamic-config";
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
  ],
  template: `
    <mdy-form #form (submitted)="submitted.emit($event)">
      @for (f of fields(); track f.name) {
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
      }
      <ng-content />
    </mdy-form>
  `,
})
export class MdyDynamicFormComponent {
  /** Serializable field configs, rendered in order. */
  readonly fields = input.required<ReadonlyArray<MdyDynamicField>>();

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
          const { validators, marksRequired } = buildDynamicValidators(
            f.validators ?? {},
          );
          form.upsertValidators(f.name, "mdy-dynamic", validators, marksRequired);
        }
      });
    });
  }
}
