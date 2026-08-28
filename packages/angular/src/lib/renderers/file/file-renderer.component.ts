import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";
import { MDY_WIDGET_CONTRACTS, createFileFieldController } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";

@Component({
  selector: "mdy-control-file",
  standalone: true,
  imports: [MdyPartDirective, NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--file",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="chosen().length > 0"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div
      class="mdy-file-container"
      [class.mdy-file-container--dragover]="dragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        #fileInput
        type="file"
        class="mdy-file-input"
        [id]="fieldId"
        [accept]="accept()"
        [multiple]="multiple()"
        [disabled]="cannotPick()"
        (change)="onFileChange($event)"
        (blur)="dispatchValueBlur('file')"
        [mdyPart]="controlPart()"
      />

      <div class="mdy-file-content">
        <button
          type="button"
          class="mdy-button"
          (click)="fileInput.click()"
          [disabled]="cannotPick()"
        >
          <svg viewBox="0 0 24 24" class="mdy-file-icon" aria-hidden="true">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          {{ multiple() ? i18n.fileSelectMultiple : i18n.fileSelect }}
        </button>

        <div class="mdy-file-info">
          @if (chosen().length > 0) {
            <ul class="mdy-file-list">
              @for (file of chosen(); track file.name) {
                <li class="mdy-file-item">
                   <span class="mdy-file-name">{{ file.name }}</span>
                </li>
              }
            </ul>
            <button
              type="button"
              class="mdy-file-clear"
              (click)="clear()"
              [disabled]="cannotPick()"
              [attr.aria-label]="i18n.fileClearSelection"
            >
              &times;
            </button>
          } @else {
            <span class="mdy-file-placeholder">{{ i18n.fileNoneSelected }}</span>
          }
        </div>
      </div>
      @if (rejectedNames().length > 0) {
        <div [mdyPart]="widgetContract.parts.rejected">{{ i18n.fileRejected(rejectedNames()) }}</div>
      }
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyFileComponent extends MdyBaseControl<readonly File[] | null> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.file;
  protected override readonly widgetKind = "file" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  /**
   * Whether the picker may be operated at all.
   *
   * A read-only file field has no word of its own — the contract declares no read-only state for
   * this kind, because the picker is the browser's and the element's role has no `aria-readonly` to
   * carry. What is expressible is that the affordance is not operable, and the field itself stays in
   * play: focusable, submitted, validated. The other two renderers already say it this way.
   */
  protected readonly cannotPick = computed(() => this.isDisabled() || this.isReadonly());

  readonly accept = input<string>("");
  readonly multiple = input<boolean>(false);
  readonly maxFileSize = input<number>(0);
  readonly maxFiles = input<number>(0);
  readonly fileSelected = output<readonly File[] | null>();
  readonly filesRejected = output<ReadonlyArray<File>>();

  /**
   * The kind's own controller, holding the handle and deciding what a pick does.
   *
   * The rule for which candidates are taken is shared already; the sequence around it was not — what
   * gets written, whether the field is marked, what the value becomes when it is cleared. This
   * renderer answered the last one with `null` where the contract answers `[]`, on a field declared
   * as a list, so a host reading it got a shape the type does not allow.
   */
  private readonly files = this.adoptFieldController(
    (handle, widgetId) => createFileFieldController<File>({
      widgetId,
      handle: handle as never,
      accept: this.accept(),
      multiple: this.multiple(),
      maxFileSize: this.maxFileSize(),
      maxFiles: this.maxFiles(),
    }),
  );

  /** What the field holds, and what its last pick turned away — a list either way. */
  protected readonly chosen = computed<readonly File[]>(() => this.value() ?? []);
  protected readonly rejectedNames = signal<readonly string[]>([]);

  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  protected readonly dragOver = signal(false);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.processFiles(input.files);
    input.value = "";
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.isDisabled()) return;
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.isDisabled()) return;
    this.processFiles(event.dataTransfer?.files || null);
  }

  protected clear(): void {
    if (this.isDisabled()) return;
    this.files()?.dispatch({ type: "clear" });
    this.rejectedNames.set([]);
    // The one thing only this renderer has: the native input keeps its own copy of the choice, and a
    // field cleared from the model with that copy left in place refuses to fire `change` when the
    // same file is picked again.
    if (this.fileInput()) this.fileInput()!.nativeElement.value = "";
    this.fileSelected.emit(null);
  }

  private processFiles(files: FileList | null): void {
    const controller = this.files();
    const before = this.value() ?? [];
    controller?.dispatch({ type: "select", files: Array.from(files ?? []) });

    // Shown as well as emitted: turning a file away in silence leaves no evidence it happened. Read
    // from the controller's state rather than recomputed here — the rule for what is refused is the
    // contract's, and a second reading of it is a second rule the day one of them changes.
    const refused = controller?.state().rejected ?? [];
    this.rejectedNames.set(refused.map((file: File) => file.name));
    if (refused.length > 0) this.filesRejected.emit(refused);

    // Announced only where something was taken. Compared rather than assumed, because a pick that
    // was entirely refused writes nothing, and a host told "these are your files" after a refusal
    // would show the previous choice as though it had just been made.
    const after = this.value() ?? [];
    if (after !== before) this.fileSelected.emit(after);
  }
}
