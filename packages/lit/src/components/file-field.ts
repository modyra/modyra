import { mdyPart } from "../mdy-part.js";
import { html, nothing, type PropertyDeclarations } from "lit";
import { type MdyFieldHandle } from "@modyra/core";
import { blocksValueChange, MDY_WIDGET_CONTRACTS, clearFileSelection, fileSelectionTransition } from "@modyra/widgets";
import { MdyFieldElement, mdyIcon } from "../base.js";

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
    const pick = (picked: readonly File[]): void => {
      // Asked of the model, not of the affordance. Disabling the button stops a pointer and nothing
      // else: a file still arrives by being dropped on the field, by a script, or through an
      // assistive technology driving the input — and each of those wrote a value the application had
      // declared unchangeable. A guard on a door is not a lock.
      if (blocksValueChange(handle.interactivity())) return;
      const transition = fileSelectionTransition(picked, {
        accept: this.accept,
        multiple: this.multiple,
      });
      this._rejected = transition.rejected;
      this.requestUpdate();
      if (transition.value === undefined) return;
      handle.set(transition.value);
      handle.markAsDirty();
      if (transition.touched) handle.markAsTouched();
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
          ?disabled=${handle.disabled() || handle.readonly()}
          ${mdyPart(this.controlPart(handle))}
          @change=${(e: Event) => pick(Array.from((e.target as HTMLInputElement).files ?? []))}
          @blur=${() => handle.markAsTouched()}
        />
        <div class="mdy-file-content">
          <button
            type="button"
            class="mdy-button"
            ?disabled=${handle.disabled() || handle.readonly()}
            @click=${() => this.querySelector<HTMLInputElement>("input[type=file]")?.click()}
          >
            ${mdyIcon("PLUS", "mdy-file-icon")}
            ${this.multiple ? "Select files" : "Select file"}
          </button>
          <div class="mdy-file-info">
            ${files.length === 0
              ? html`<span class="mdy-file-placeholder">${this.placeholder || this.messages.fileSelect}</span>`
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
                          this._rejected = [];
                          handle.set(rest.length === 0 ? (clearFileSelection<File>().value ?? []) : rest);
                          handle.markAsDirty();
                        }}
                      >
                        ✕
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
