import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { createFileFieldController, MDY_WIDGET_CONTRACTS, clearFileSelection, type MdyFileFieldController , chipActionName,
  partClasses,
  presentationClass,
} from "@modyra/widgets";
import { MdyFieldElement, mdyIcon } from "../base.js";

/**
 * The class every part and box wears, asked of the contract once. A second copy of a name the
 * catalogue holds is where the two come to disagree without either moving.
 */
const CLASS = {
  clear: partClasses("file", "clear").join(" "),
  content: partClasses("file", "content").join(" "),
  control: partClasses("file", "control").join(" "),
  dropzone: partClasses("file", "dropzone").join(" "),
  fileItem: partClasses("file", "fileItem").join(" "),
  fileList: partClasses("file", "fileList").join(" "),
  icon: presentationClass("file", "icon"),
  info: presentationClass("file", "info"),
  name: presentationClass("file", "name"),
  placeholder: presentationClass("file", "placeholder"),
  remove: presentationClass("file", "remove"),
} as const;


/**
 * What one chosen item is called, for a value that is not a file.
 *
 * A form's value is whatever was put in it — a draft restored from storage, a server's answer, a
 * default written by hand — and only a picker produces `File`s. Anything else has no `name`, and a
 * control named after one crashed the field on its first paint rather than drawing a row without a
 * caption. Empty is the honest answer: the row shows nothing where the name goes, and the control
 * beside it falls back to its bare verb.
 */
function fileName(file: File): string {
  return typeof file?.name === "string" ? file.name : "";
}

export class MdyFileFieldElement extends MdyFieldElement<readonly File[] | null> {
  static override properties: PropertyDeclarations = {
    multiple: { type: Boolean },
    accept: { type: String },
    placeholder: { type: String },
  };
  declare multiple: boolean;
  declare accept: string;
  declare placeholder: string;
  protected override readonly widgetKind = "file" as const;

  constructor() {
    super();
    this.multiple = false;
    this.accept = "";
    this.placeholder = "";
  }

  private _dragOver = false;
  /** What the last pick turned away — not part of the value, and the only record that it happened. */
  private _rejected: readonly File[] = [];
  private _fileController?: MdyFileFieldController<File>;

  /**
   * Built once and kept: a controller made per render would lose what the last pick turned away,
   * which is the one piece of state that outlives a render and is not the value.
   */
  private fileController(handle: MdyFieldHandle<readonly File[] | null>): MdyFileFieldController<File> {
    this._fileController ??= createFileFieldController<File>({
      widgetId: this.fieldId,
      handle: handle as never,
      ...(this.accept === undefined ? {} : { accept: this.accept }),
      multiple: this.multiple,
    });
    return this._fileController;
  }

  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<readonly File[] | null>): unknown {
    // A value the model was allowed to hold, not only the one this element writes. `patchValue` is
    // public and a draft is data: a bare file, a string or a number reaches here, and `map` on it
    // threw from inside the render — an effect that throws stops running, so the control kept what
    // it was showing and the page had nothing to read.
    const held = handle.value() as unknown;
    const files: readonly File[] = Array.isArray(held) ? held as readonly File[] : held ? [held as File] : [];
    // The same policy the other renderers apply, from the one place that holds it: which candidates
    // the accept tokens take, how many, and what the field ends up holding. Choosing here instead
    // meant an element that ignored `accept` on a drop and wrote a bare `File`, which is not the
    // shape `MDY_VALUE_CONTRACTS.file` declares.
    // The rules a pick goes through are the contract's: what is accepted, what is turned away, and
    // that the guard belongs on the model rather than on the button — a file still arrives by being
    // dropped, by a script, or through an assistive technology driving the input.
    const controller = this.fileController(handle);
    const pick = (picked: readonly File[]): void => {
      controller.dispatch({ type: "select", files: picked });
      this._rejected = controller.state().rejected;
      this.requestUpdate();
    };
    return html`
      <div
        class="${CLASS.dropzone} ${this._dragOver ? "mdy-file-container--dragover" : ""}"
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this._dragOver = true;
          this.requestUpdate();
        }}
        @dragleave=${() => {
          this._dragOver = false;
          this.requestUpdate();
        }}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this._dragOver = false;
          pick(Array.from(e.dataTransfer?.files ?? []));
        }}
      >
        <input
          id=${this.fieldId}
          type="file"
          class="${CLASS.control}"
          ?multiple=${this.multiple}
          accept=${this.accept || nothing}
          ?disabled=${handle.disabled() || handle.readonly()}
          ${mdyPart(this.controlPart(handle))}
          @change=${(e: Event) => pick(Array.from((e.target as HTMLInputElement).files ?? []))}
        />
        <div class="${CLASS.content}">
          <button
            type="button"
            class="mdy-button"
            ?disabled=${handle.disabled() || handle.readonly()}
            @click=${() => this.querySelector<HTMLInputElement>("input[type=file]")?.click()}
          >
            ${mdyIcon("PLUS", CLASS.icon)}
            ${this.multiple ? "Select files" : "Select file"}
          </button>
          <!-- Beside the control that picks: below the list its place would be the number of files
               chosen, and it would move every time one arrived or left. ADR 0171, ADR 0173. -->
          <button
              type="button"
              class="${CLASS.clear} ${this.partStateClass("clear", "disabled", files.length === 0 || handle.disabled() || handle.readonly())}"
              aria-disabled=${String(files.length === 0 || handle.disabled() || handle.readonly())}
              aria-label=${this.messages.fileClearSelection}
              title=${this.messages.fileClearSelection}
              @click=${(e: Event) => {
                e.preventDefault();
                if ((e.currentTarget as HTMLElement).getAttribute("aria-disabled") === "true") return;
                this.fileController(handle).dispatch({ type: "clear" });
              }}
            ><!-- The mark is a drawing made of a character, so it is out of the tree: left in, a
                 reader says "multiplication sign" before the name. The title is the word itself —
                 somebody driving by voice says what they can see, and a glyph is not something a
                 person says. --><span aria-hidden="true">&times;</span></button>
          <div class="${CLASS.info}">
            ${files.length === 0
              ? html`<span class="${CLASS.placeholder}">${this.placeholder || this.messages.fileSelect}</span>`
              : html`<ul class="${CLASS.fileList}">
                  ${files.map(
                    (f, i) => html`<li class="${CLASS.fileItem}">
                      <span class="${CLASS.name}">${fileName(f)}</span>
                      <button
                        type="button"
                        class="${CLASS.remove}"
                        aria-label=${chipActionName(this.messages.chipRemoveLabel, fileName(f))}
                        title=${chipActionName(this.messages.chipRemoveLabel, fileName(f))}
                        @click=${(e: Event) => {
                          e.preventDefault();
                          const rest = files.filter((_, j) => j !== i);
                          this._rejected = [];
                          handle.set(rest.length === 0 ? (clearFileSelection<File>().value ?? []) : rest);
                          handle.markAsDirty();
                        }}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>`,
                  )}
                </ul>`}

          </div>
          ${this._rejected.length === 0
            ? nothing
            : html`<div ${mdyPart(MDY_WIDGET_CONTRACTS.file.parts.rejected)}>
                ${this.messages.fileRejected(this._rejected.map((file) => file.name))}
              </div>`}
        </div>
      </div>
    `;
  }
}
