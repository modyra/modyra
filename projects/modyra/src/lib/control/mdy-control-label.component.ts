import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyInlineErrorIconComponent } from "./inline-error-icon.component";

/**
 * Shared label + optional inline-error-icon block.
 *
 * Eliminates the duplicated `@if (label()) { <label>...</label> }` pattern
 * that was copy-pasted across every renderer component.
 *
 * ```html
 * <mdy-control-label
 *   [label]="label()"
 *   [forId]="fieldId"
 *   [showInlineError]="inlineErrors && touched() && hasErrors()"
 *   [errorText]="inlineErrorText()"
 * />
 * ```
 */
@Component({
  selector: "mdy-control-label",
  standalone: true,
  imports: [MdyInlineErrorIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: contents" },
  template: `
    @if (label()) {
      <label
        [for]="forId()"
        [attr.id]="labelId() || null"
        class="mdy-label"
        [class.mdy-label--filled]="filled()"
        [class.mdy-label--has-error]="showInlineError()"
      >
        {{ label() }}
        @if (required()) {
          <span
            class="mdy-label__required"
            [class.mdy-label__required--filled]="filled()"
            aria-hidden="true"
            >*</span
          >
        }
        @if (showInlineError()) {
          <mdy-inline-error-icon [errorText]="errorText()" />
        }
      </label>
    }
  `,
})
export class MdyControlLabelComponent {
  /** The label text. If empty, renders nothing. */
  readonly label = input<string>("");

  /** The `id` of the input this label is associated with (maps to `[for]`). */
  readonly forId = input<string>("");

  /**
   * Optional `id` rendered on the `<label>` itself, so group renderers
   * (radio, segmented) can reference it via `aria-labelledby` (B33).
   */
  readonly labelId = input<string>("");

  /** When `true`, the inline error icon is rendered inside the label. */
  readonly showInlineError = input<boolean>(false);

  /** Error text passed to the inline error icon tooltip. */
  readonly errorText = input<string>("");

  /** Whether to show a required asterisk. */
  readonly required = input<boolean>(false);

  /** Whether the field is filled (has a value). */
  readonly filled = input<boolean>(false);
}
