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
    @if (shown()) {
      <label
        [for]="forId()"
        [attr.id]="renderedId()"
        class="mdy-label"
        [class.mdy-label--filled]="filled()"
        [class.mdy-label--has-error]="hasError() || showInlineError()"
        [class.mdy-label--unwritten]="!label()"
      ><!--
        The text and the marker sit against each other on purpose. A newline between them is a text
        node, and a text node is part of the computed accessible name: the control ends up called
        "First Name " while the user reads "First Name", and anything matching on the name exactly —
        a test, an assistive tool's find-by-name — misses it.
      -->{{ shownText() }}@if (required()) {
          <span
            class="mdy-label__required"
            [class.mdy-label__required--filled]="filled()"
            aria-hidden="true"
            >*</span
          >
        }
        @if (showInlineError()) {
          <mdy-inline-error-icon [errorText]="errorText()" [errorsId]="errorsId()" />
        }
      </label>
    }
  `,
})
export class MdyControlLabelComponent {
  /** The id the field's errors are named by, passed to the inline message that carries them. */
  readonly errorsId = input<string>("");

  /** The caption a document wrote. Empty where none was written. */
  readonly label = input<string>("");

  /**
   * The name the field resolves to when no caption was written.
   *
   * Everything inside a field is named by pointing at this element — a panel's `aria-labelledby`
   * resolves here — and a reference that lands on nothing announces the role and nothing else. So the
   * element exists whenever the field has words at all, carrying whatever the resolver chose, and
   * where those words are the field's own key rather than a person's it is taken out of sight by
   * `mdy-label--unwritten`. A name is owed to a screen reader; a heading is not.
   */
  readonly words = input<string>("");

  /** Whether there is anything to draw: a caption, or a name the field could resolve. */
  protected readonly shown = computed(() => (this.label() || this.words()).trim().length > 0);

  /** What the caption says: the document's words where it wrote them, the resolver's otherwise. */
  protected readonly shownText = computed(() => this.label() || this.words());

  /**
   * Whether the field this label belongs to is failing.
   *
   * Distinct from `showInlineError`, which says *where* the message is drawn. The label used to take
   * its state from that alone, so a field showing its errors in a list below — the default — had a
   * label that never marked itself, and a theme keying off the class painted nothing on the field
   * the form had refused.
   */
  readonly hasError = input<boolean>(false);

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
