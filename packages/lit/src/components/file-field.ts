import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { MdyFieldElement, mdyIcon } from "../base.js";

export class MdyFileFieldElement extends MdyFieldElement<File | File[] | null> {
  static override properties: PropertyDeclarations = {
    multiple: { type: Boolean },
    accept: { type: String },
    placeholder: { type: String },
  };
  declare multiple: boolean;
  declare accept: string;
  declare placeholder: string;
  protected override readonly rendererClass = "mdy-renderer--file";

  constructor() {
    super();
    this.multiple = false;
    this.accept = "";
    this.placeholder = "";
  }

  private _dragOver = false;

  protected override get useWrapper(): boolean {
    return false;
  }

  protected override renderControl(handle: MdyFieldHandle<File | File[] | null>): unknown {
    const current = handle.value();
    const files = current === null ? [] : Array.isArray(current) ? current : [current];
    const pick = (picked: File[]): void => {
      handle.set(this.multiple ? picked : (picked[0] ?? null));
      handle.markAsDirty();
      handle.markAsTouched();
    };
    return html`
      <div
        class="mdy-file-container ${this._dragOver ? "mdy-file-container--dragover" : ""}"
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
          class="mdy-file-input"
          ?multiple=${this.multiple}
          accept=${this.accept || nothing}
          ?disabled=${handle.disabled()}
          aria-invalid=${handle.errors().length > 0 ? "true" : "false"}
          aria-required=${handle.required() ? "true" : "false"}
          @change=${(e: Event) => pick(Array.from((e.target as HTMLInputElement).files ?? []))}
          @blur=${() => handle.markAsTouched()}
        />
        <div class="mdy-file-content">
          ${mdyIcon("PLUS", "mdy-file-icon")}
          <div class="mdy-file-info">
            ${files.length === 0
              ? html`<span class="mdy-file-placeholder">${this.placeholder || "Choose a file or drop it here"}</span>`
              : html`<ul class="mdy-file-list">
                  ${files.map(
                    (f, i) => html`<li class="mdy-file-item">
                      <span class="mdy-file-name">${f.name}</span>
                      <button
                        type="button"
                        class="mdy-file-clear"
                        aria-label=${`Remove ${f.name}`}
                        @click=${(e: Event) => {
                          e.preventDefault();
                          const rest = files.filter((_, j) => j !== i);
                          handle.set(this.multiple ? rest : null);
                          handle.markAsDirty();
                        }}
                      >
                        ✕
                      </button>
                    </li>`,
                  )}
                </ul>`}
          </div>
        </div>
      </div>
    `;
  }
}
