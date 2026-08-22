import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { defaultWidgetIdFactory } from "@modyra/widgets";
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
 *   [showInlineError]="inlineErrorShown()"
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
        [attr.id]="renderedId()"
        class="mdy-label"
        [class.mdy-label--filled]="filled()"
        [class.mdy-label--has-error]="showInlineError()"
      ><!--
        The text and the marker sit against each other on purpose. A newline between them is a text
        node, and a text node is part of the computed accessible name: the control ends up called
        "First Name " while the user reads "First Name", and anything matching on the name exactly —
        a test, an assistive tool's find-by-name — misses it.
      -->{{ label() }}@if (required()) {
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

  /**
   * The id this label carries, which is the one the projections name it by.
   *
   * Every popup's inner view is labelled by the field's own label — `aria-labelledby="<widget>__label"`
   * comes out of the widget projections — and a label with no id leaves every one of those references
   * pointing at nothing. Callers that need a different id pass `labelId`; the rest get the canonical
   * one built from the field they are labelling, rather than none.
   */
  protected readonly renderedId = computed(() =>
    this.labelId() || (this.widgetId() || this.forId()
      ? defaultWidgetIdFactory.part(this.widgetId() || this.forId(), "label")
      : null),
  );

  /**
   * The widget whose label this is. Falls back to what the label points at, which is the control's
   * own id for every kind that labels a control rather than a group.
   */
  readonly widgetId = input<string>("");

  /** When `true`, the inline error icon is rendered inside the label. */
  readonly showInlineError = input<boolean>(false);

  /** Error text passed to the inline error icon tooltip. */
  readonly errorText = input<string>("");

  /** Whether to show a required asterisk. */
  readonly required = input<boolean>(false);

  /** Whether the field is filled (has a value). */
  readonly filled = input<boolean>(false);
}
