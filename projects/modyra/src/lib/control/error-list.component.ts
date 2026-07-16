import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyFieldError } from "../core/types";

/**
 * Block error list displayed below a form control.
 *
 * Renders a `<ul>` of validation error messages. Used when
 * `mdyInlineErrors` is **not** applied to a renderer.
 *
 * ```html
 * <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
 * ```
 */
@Component({
  selector: "mdy-error-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: contents" },
  template: `
    <ul
      [id]="fieldId() + '-errors'"
      class="mdy-control__errors"
      role="alert"
      aria-live="polite"
    >
      @for (err of errors(); track $index) {
        <li class="mdy-control__error">{{ err.message }}</li>
      }
    </ul>
  `,
})
export class MdyErrorListComponent {
  readonly fieldId = input.required<string>();
  readonly errors = input.required<ReadonlyArray<MdyFieldError>>();
}
