import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MdyIconComponent } from "./mdy-icon.component";

/**
 * Inline error icon with hover/focus tooltip.
 *
 * Renders a warning triangle SVG that reveals the error message on
 * hover or keyboard focus. Used inside labels when `mdyInlineErrors`
 * is applied to a renderer.
 *
 * ```html
 * <mdy-inline-error-icon [errorText]="inlineErrorText()" />
 * ```
 */
@Component({
  selector: "mdy-inline-error-icon",
  standalone: true,
  imports: [MdyIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // role="img" + aria-label: the icon conveys the error without being a
  // focusable-but-non-interactive element; the message itself is already
  // linked to the input via aria-describedby (B36).
  host: {
    class: "mdy-control__inline-errors",
    role: "img",
    "[attr.aria-label]": "errorText()",
  },
  template: `
    <mdy-icon name="ERROR" class="mdy-control__inline-errors-icon" style="vertical-align: middle; margin-top: -1px; width: 0.85em; height: 0.85em;" />
    <span class="mdy-control__inline-errors-tooltip">{{ errorText() }}</span>
  `,
})
export class MdyInlineErrorIconComponent {
  readonly errorText = input.required<string>();
}
