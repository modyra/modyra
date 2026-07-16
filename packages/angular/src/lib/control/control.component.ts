import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Optional wrapper component for form controls.
 *
 * Provides a styled container with data-field attribute.
 * Error display is handled by each renderer component directly.
 *
 * Usage:
 * ```html
 * <mdy-control name="firstName">
 *   <mdy-text name="firstName" label="First Name" />
 * </mdy-control>
 * ```
 */
@Component({
  selector: "mdy-control",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mdy-control">
      <ng-content />
    </div>
  `,
  host: {
    "[attr.data-field]": "name()",
  },
})
export class MdyControlComponent {
  readonly name = input.required<string>();
}
