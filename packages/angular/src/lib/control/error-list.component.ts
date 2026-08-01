import { defaultWidgetIdFactory } from "@modyra/widgets";
import { ChangeDetectionStrategy, Component, input, computed } from "@angular/core";
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
      [id]="errorsId()"
      class="mdy-control__errors"
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

  /**
   * The id comes from the shared factory rather than a local string, so that everything naming this
   * list — a projection's `aria-describedby` included — resolves to the element actually rendered.
   * Two spellings of one relation is how a reference silently dangles.
   */
  protected readonly errorsId = computed(() =>
    defaultWidgetIdFactory.part(this.fieldId(), "errors"),
  );
}
