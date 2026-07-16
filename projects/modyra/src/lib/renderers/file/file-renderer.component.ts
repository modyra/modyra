import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MDY_I18N_MESSAGES } from "../../core/i18n";

/**
 * File Upload renderer component.
 */
@Component({
  selector: "mdy-control-file",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.mdy-floating-label]": "isFloatingLabel()",
    class: "mdy-renderer mdy-renderer--file",
    "[class.mdy-inline-errors]": "inlineErrors",
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="fileNames().length > 0"
      [showInlineError]="inlineErrors && touched() && hasErrors()"
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
        [disabled]="isDisabled()"
        (change)="onFileChange($event)"
        (blur)="markAsTouched()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
      />

      <div class="mdy-file-content">
        <button
          type="button"
          class="mdy-button"
          (click)="fileInput.click()"
          [disabled]="isDisabled()"
        >
          <svg viewBox="0 0 24 24" class="mdy-file-icon" aria-hidden="true">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          {{ multiple() ? i18n.fileSelectMultiple : i18n.fileSelect }}
        </button>

        <div class="mdy-file-info">
          @if (fileNames().length > 0) {
            <ul class="mdy-file-list">
              @for (name of fileNames(); track name) {
                <li class="mdy-file-item">
                   <span class="mdy-file-name">{{ name }}</span>
                </li>
              }
            </ul>
            <button
              type="button"
              class="mdy-file-clear"
              (click)="clear()"
              [disabled]="isDisabled()"
              [attr.aria-label]="i18n.fileClearSelection"
            >
              &times;
            </button>
          } @else {
            <span class="mdy-file-placeholder">{{ i18n.fileNoneSelected }}</span>
          }
        </div>
      </div>
    </div>

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdyFileComponent extends MdyBaseControl<File | File[] | null> {
  readonly accept = input<string>("");
  readonly multiple = input<boolean>(false);
  /** Maximum size per file in bytes (0 = no limit). Applies to picker and drop. */
  readonly maxFileSize = input<number>(0);
  /** Maximum number of files when [multiple] (0 = no limit). */
  readonly maxFiles = input<number>(0);
  readonly fileSelected = output<File | File[] | null>();
  /** Emits the files rejected by accept/maxFileSize/maxFiles filtering. */
  readonly filesRejected = output<ReadonlyArray<File>>();

  protected readonly i18n = inject(MDY_I18N_MESSAGES);

  protected readonly fieldId = `mdy-control-file-${MdyBaseControl.nextId()}`;
  protected readonly dragOver = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");

  protected readonly fileNames = computed(() => {
    const val = this.value();
    if (!val) return [];
    if (Array.isArray(val)) return val.map(f => f.name);
    return [val.name];
  });

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.processFiles(input.files);
    // Reset the native input so picking the same file again (after a clear,
    // a rejection, or a programmatic value change) re-fires `change` (R12).
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
    this.setValue(null);
    this.markAsDirty();
    if (this.fileInput()) {
      this.fileInput()!.nativeElement.value = "";
    }
    this.fileSelected.emit(null);
  }

  private processFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;

    // Dropped files bypass the native input's [accept] filtering, so the
    // same constraints (accept, maxFileSize, maxFiles) are enforced here (B19).
    const all = Array.from(files);
    let accepted = all.filter(
      f => this.matchesAccept(f) && this.withinSizeLimit(f),
    );
    const rejected = all.filter(f => !accepted.includes(f));

    const limit = this.maxFiles();
    if (this.multiple() && limit > 0 && accepted.length > limit) {
      rejected.push(...accepted.slice(limit));
      accepted = accepted.slice(0, limit);
    }

    if (rejected.length > 0) this.filesRejected.emit(rejected);
    if (accepted.length === 0) return;

    if (this.multiple()) {
      this.setValue(accepted);
    } else {
      this.setValue(accepted[0]!);
    }
    this.markAsDirty();
    this.markAsTouched();
    this.fileSelected.emit(this.value());
  }

  /** Mirrors the native input's accept matching: .ext, type/*, exact MIME. */
  private matchesAccept(file: File): boolean {
    const accept = this.accept().trim();
    if (!accept) return true;
    return accept
      .split(",")
      .map(token => token.trim().toLowerCase())
      .filter(token => token.length > 0)
      .some(token => {
        if (token.startsWith(".")) {
          return file.name.toLowerCase().endsWith(token);
        }
        if (token.endsWith("/*")) {
          return file.type.toLowerCase().startsWith(token.slice(0, -1));
        }
        return file.type.toLowerCase() === token;
      });
  }

  private withinSizeLimit(file: File): boolean {
    const max = this.maxFileSize();
    return max <= 0 || file.size <= max;
  }
}
